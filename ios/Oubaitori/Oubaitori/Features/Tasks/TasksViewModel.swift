import Foundation
import Combine

enum TodoColumn: String, CaseIterable, CustomStringConvertible {
    case today = "Сегодня"
    case week = "Неделя"
    case all = "Все"

    var description: String { rawValue }
}

@MainActor
final class TasksViewModel: ObservableObject {
    @Published var items: [TodoDTO] = []
    @Published var error: String?
    @Published var newText = ""
    @Published var segment: TodoColumn = .today

    func load() async {
        do {
            items = try await APIClient.shared.request("GET", path: "todos")
        } catch let err {
            error = err.localizedDescription
        }
    }

    func column(for todo: TodoDTO) -> TodoColumn {
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

    var filteredItems: [TodoDTO] {
        switch segment {
        case .today:
            return items.filter { !$0.isCompleted && column(for: $0) == .today }
        case .week:
            return items.filter { !$0.isCompleted && (column(for: $0) == .today || column(for: $0) == .week) }
        case .all:
            return items.filter { !$0.isCompleted }
        }
    }

    func add() async {
        let text = newText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        let today = fmt.string(from: Date())
        do {
            let _: TodoDTO = try await APIClient.shared.request(
                "POST",
                path: "todos",
                body: CreateTodoBody(text: text, due_date: today)
            )
            newText = ""
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }

    func toggle(_ id: Int) async {
        do {
            try await APIClient.shared.requestVoid("POST", path: "todos/\(id)/toggle")
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }
}
