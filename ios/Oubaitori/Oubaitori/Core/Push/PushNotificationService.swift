import Foundation
import UIKit
import UserNotifications

struct RegisterDeviceBody: Encodable {
    let deviceToken: String
    let environment: String
    let platform: String
}

struct DeleteDeviceBody: Encodable {
    let deviceToken: String
}

struct DevicePreferencesDTO: Codable {
    let enabled: Bool?
    let medications: Bool?
    let workouts: Bool?
    let expenses: Bool?
}

struct PatchDevicePreferencesBody: Encodable {
    let enabled: Bool?
    let medications: Bool?
    let workouts: Bool?
    let expenses: Bool?
}

@MainActor
final class PushNotificationService: NSObject, ObservableObject {
    static let shared = PushNotificationService()

    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var lastRegisteredToken: String?

    private override init() {
        super.init()
    }

    var apnsEnvironment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    func refreshAuthorizationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authorizationStatus = settings.authorizationStatus
    }

    func requestPermissionAndRegister() async {
        await refreshAuthorizationStatus()
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            await refreshAuthorizationStatus()
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            print("[push] permission error:", error.localizedDescription)
        }
    }

    func registerIfNeeded() async {
        await refreshAuthorizationStatus()
        switch authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            UIApplication.shared.registerForRemoteNotifications()
        case .notDetermined:
            await requestPermissionAndRegister()
        default:
            break
        }
    }

    func handleDeviceToken(_ data: Data) async {
        let token = data.map { String(format: "%02x", $0) }.joined()
        guard !token.isEmpty else { return }
        lastRegisteredToken = token
        guard AuthRepository.shared.isAuthenticated else { return }
        do {
            let _: SuccessDTO = try await APIClient.shared.request(
                "POST",
                path: "devices",
                body: RegisterDeviceBody(deviceToken: token, environment: apnsEnvironment, platform: "ios")
            )
        } catch {
            print("[push] token upload failed:", error.localizedDescription)
        }
    }

    func unregisterFromServer() async {
        guard let token = lastRegisteredToken else { return }
        _ = try? await APIClient.shared.requestVoid(
            "DELETE",
            path: "devices",
            body: DeleteDeviceBody(deviceToken: token)
        )
        lastRegisteredToken = nil
    }

    func loadPreferences() async -> DevicePreferencesDTO? {
        try? await APIClient.shared.request("GET", path: "devices/preferences")
    }

    func savePreferences(_ prefs: PatchDevicePreferencesBody) async throws {
        let _: SuccessDTO = try await APIClient.shared.request(
            "PATCH",
            path: "devices/preferences",
            body: prefs
        )
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

private struct SuccessDTO: Codable {
    let success: Bool?
}

extension PushNotificationService: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        await MainActor.run {
            PushDeepLinkRouter.shared.handle(userInfo: userInfo)
        }
    }
}
