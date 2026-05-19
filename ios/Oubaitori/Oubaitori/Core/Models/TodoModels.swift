import Foundation

struct TodoDTO: Codable, Identifiable {
    let id: Int
    var text: String
    var due_date: String?
    var time: String?
    var completed: Int?

    var isCompleted: Bool { (completed ?? 0) == 1 }
}

struct CreateTodoBody: Encodable {
    let text: String
    let due_date: String?
}
