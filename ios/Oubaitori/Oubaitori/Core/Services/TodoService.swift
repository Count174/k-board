import Foundation

enum TodoService {
    static func todayString() -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    static func column(for todo: TodoDTO) -> TodoColumn {
        guard let ds = todo.due_date, !ds.isEmpty else { return .all }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard let d = fmt.date(from: String(ds.prefix(10))) else { return .all }
        let cal = Calendar.current
        if cal.isDateInToday(d) { return .today }
        let endOfWeek = cal.date(byAdding: .day, value: 7, to: cal.startOfDay(for: Date()))!
        if d < endOfWeek { return .week }
        return .all
    }

    @MainActor
    static func toggle(_ id: Int) async throws {
        try await APIClient.shared.requestVoid("POST", path: "todos/\(id)/toggle")
    }
}
