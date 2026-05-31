import Foundation
import Combine

@MainActor
final class AuthRepository: ObservableObject {
    static let shared = AuthRepository()

    @Published private(set) var currentUser: UserDTO?
    @Published private(set) var isAuthenticated = false

    private init() {
        if KeychainStore.load(key: KeychainStore.Keys.accessToken) != nil {
            isAuthenticated = true
        }
    }

    func login(email: String, password: String) async throws {
        let body = LoginBody(email: email.trimmingCharacters(in: .whitespaces).lowercased(), password: password)
        let res: AuthResponseDTO = try await APIClient.shared.request("POST", path: "auth/login", body: body, authorized: false)
        try persistSession(res)
    }

    func register(name: String, email: String, password: String) async throws {
        let body = RegisterBody(
            name: name.trimmingCharacters(in: .whitespaces),
            email: email.trimmingCharacters(in: .whitespaces).lowercased(),
            password: password
        )
        let res: AuthResponseDTO = try await APIClient.shared.request("POST", path: "auth/register", body: body, authorized: false)
        try persistSession(res)
    }

    func loadMe() async throws {
        let user: UserDTO = try await APIClient.shared.request("GET", path: "auth/me")
        currentUser = user
        isAuthenticated = true
    }

    @discardableResult
    func refreshSession() async throws -> Bool {
        guard let refresh = KeychainStore.load(key: KeychainStore.Keys.refreshToken) else {
            return false
        }
        let res: AuthResponseDTO = try await APIClient.shared.request(
            "POST",
            path: "auth/refresh",
            body: RefreshBody(refreshToken: refresh),
            authorized: false
        )
        try persistSession(res)
        return true
    }

    func logout() async {
        await PushNotificationService.shared.unregisterFromServer()
        let refresh = KeychainStore.load(key: KeychainStore.Keys.refreshToken)
        _ = try? await APIClient.shared.requestVoid(
            "POST",
            path: "auth/logout",
            body: LogoutBody(refreshToken: refresh),
            authorized: false
        )
        KeychainStore.clearSession()
        currentUser = nil
        isAuthenticated = false
    }

    private func persistSession(_ res: AuthResponseDTO) throws {
        guard let access = res.accessToken, let refresh = res.refreshToken else {
            throw APIError.server("Сервер не вернул токены")
        }
        try KeychainStore.save(access, key: KeychainStore.Keys.accessToken)
        try KeychainStore.save(refresh, key: KeychainStore.Keys.refreshToken)
        currentUser = res.user
        isAuthenticated = true
        Task { await PushNotificationService.shared.registerIfNeeded() }
    }
}
