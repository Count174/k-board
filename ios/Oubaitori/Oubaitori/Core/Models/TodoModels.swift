import Foundation

enum TodoColumn: String, CaseIterable, CustomStringConvertible {
    case today = "Сегодня"
    case week = "Неделя"
    case all = "Все"

    var description: String { rawValue }
}

struct TodoDTO: Codable, Identifiable {
    let id: Int
    var text: String
    var due_date: String?
    var time: String?
    var completed: Int?

    var isCompleted: Bool { (completed ?? 0) == 1 }

    enum CodingKeys: String, CodingKey {
        case id, text, time
        case due_date
        case dueDate
        case completed
        case done
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        text = try c.decode(String.self, forKey: .text)
        due_date = try c.decodeIfPresent(String.self, forKey: .due_date)
            ?? c.decodeIfPresent(String.self, forKey: .dueDate)
        time = try c.decodeIfPresent(String.self, forKey: .time)
        if let comp = try c.decodeIfPresent(Int.self, forKey: .completed) {
            completed = comp
        } else if let done = try c.decodeIfPresent(Bool.self, forKey: .done) {
            completed = done ? 1 : 0
        } else {
            completed = 0
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(text, forKey: .text)
        try c.encodeIfPresent(due_date, forKey: .due_date)
        try c.encodeIfPresent(time, forKey: .time)
        try c.encode(completed ?? 0, forKey: .completed)
    }
}

struct CreateTodoBody: Encodable {
    let text: String
    let dueDate: String?

    enum CodingKeys: String, CodingKey {
        case text
        case dueDate
        case due_date
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(text, forKey: .text)
        try c.encodeIfPresent(dueDate, forKey: .dueDate)
        try c.encodeIfPresent(dueDate, forKey: .due_date)
    }

    init(text: String, due_date: String?) {
        self.text = text
        self.dueDate = due_date
    }
}
