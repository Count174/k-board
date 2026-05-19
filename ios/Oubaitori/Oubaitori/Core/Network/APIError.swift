import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case server(String)
    case decoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Некорректный URL"
        case .unauthorized: return "Сессия истекла. Войдите снова."
        case .server(let msg): return msg
        case .decoding: return "Ошибка разбора ответа"
        case .network(let e): return e.localizedDescription
        }
    }
}
