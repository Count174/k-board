import Foundation

enum AppConfig {
    /// Базовый URL API. Должен заканчиваться на `/`, иначе относительные пути (`auth/login`) уйдут мимо `/api`.
    static var apiBaseURL: URL {
        let raw = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String)
            ?? "https://o-board.ru/api"
        return normalizeAPIBase(raw)
    }

    private static func normalizeAPIBase(_ string: String) -> URL {
        var s = string.trimmingCharacters(in: .whitespacesAndNewlines)
        while s.hasSuffix("/") { s.removeLast() }
        guard let url = URL(string: s + "/") else {
            preconditionFailure("Invalid API_BASE_URL: \(string)")
        }
        return url
    }
}
