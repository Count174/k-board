import Foundation

@MainActor
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
        encoder = JSONEncoder()
    }

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: Encodable? = nil,
        authorized: Bool = true
    ) async throws -> T {
        let data = try await requestData(method, path: path, body: body, authorized: authorized)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    func requestVoid(
        _ method: String,
        path: String,
        body: Encodable? = nil,
        authorized: Bool = true
    ) async throws {
        _ = try await requestData(method, path: path, body: body, authorized: authorized)
    }

    private func requestData(
        _ method: String,
        path: String,
        body: Encodable?,
        authorized: Bool
    ) async throws -> Data {
        guard let url = Self.url(for: path) else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authorized, let token = KeychainStore.load(key: KeychainStore.Keys.accessToken) {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try encoder.encode(AnyEncodable(body))
        }

        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.server("Нет ответа сервера")
            }

            if http.statusCode == 401, authorized {
                if try await AuthRepository.shared.refreshSession() {
                    return try await requestData(method, path: path, body: body, authorized: authorized)
                }
                throw APIError.unauthorized
            }

            guard (200..<300).contains(http.statusCode) else {
                let msg = parseErrorMessage(data) ?? "Ошибка \(http.statusCode)"
                throw APIError.server(msg)
            }

            return data
        } catch let e as APIError {
            throw e
        } catch {
            throw APIError.network(error)
        }
    }

    /// `https://o-board.ru/api/` + `auth/login` → `https://o-board.ru/api/auth/login`
    static func url(for path: String) -> URL? {
        let clean = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard let url = URL(string: clean, relativeTo: AppConfig.apiBaseURL)?.absoluteURL else {
            return nil
        }
        return url
    }

    private func parseErrorMessage(_ data: Data) -> String? {
        struct ErrBody: Decodable { let error: String? }
        return (try? decoder.decode(ErrBody.self, from: data))?.error
    }
}

private struct AnyEncodable: Encodable {
    private let encode: (Encoder) throws -> Void
    init(_ wrapped: Encodable) {
        encode = wrapped.encode
    }
    func encode(to encoder: Encoder) throws { try encode(encoder) }
}
