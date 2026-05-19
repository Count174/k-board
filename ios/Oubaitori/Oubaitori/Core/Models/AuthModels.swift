import Foundation

struct UserDTO: Codable, Identifiable {
    let id: Int
    let name: String
    let email: String
}

struct AuthResponseDTO: Codable {
    let success: Bool?
    let user: UserDTO?
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let tokenType: String?
}

struct LoginBody: Encodable {
    let email: String
    let password: String
}

struct RegisterBody: Encodable {
    let name: String
    let email: String
    let password: String
}

struct RefreshBody: Encodable {
    let refreshToken: String
}

struct LogoutBody: Encodable {
    let refreshToken: String?
}
