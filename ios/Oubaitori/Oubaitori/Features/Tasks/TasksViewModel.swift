import Foundation
import Combine

@MainActor
final class TasksViewModel: ObservableObject {
    @Published var items: [TodoDTO] = []
    @Published var error: String?
    @Published var newText = ""
    @Published var segment: TodoColumn = .today
    @Published var undoToast: UndoToast?

    func load() async {
        do {
            items = try await APIClient.shared.request("GET", path: "todos")
        } catch let err {
            error = err.localizedDescription
        }
    }

    var filteredItems: [TodoDTO] {
        switch segment {
        case .today:
            return items.filter { !$0.isCompleted && TodoService.column(for: $0) == .today }
        case .week:
            return items.filter { !$0.isCompleted && (TodoService.column(for: $0) == .today || TodoService.column(for: $0) == .week) }
        case .all:
            return items.filter { !$0.isCompleted }
        }
    }

    func add() async {
        let text = newText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        do {
            let _: TodoDTO = try await APIClient.shared.request(
                "POST",
                path: "todos",
                body: CreateTodoBody(text: text, due_date: TodoService.todayString())
            )
            newText = ""
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }

    func complete(_ todo: TodoDTO) async {
        guard !todo.isCompleted else { return }
        let title = todo.text
        do {
            try await TodoService.toggle(todo.id)
            await load()
            undoToast = UndoToast(message: "«\(title)» выполнена", undoTitle: "Отменить") { [weak self] in
                Task { await self?.toggle(todo.id) }
            }
        } catch let err {
            error = err.localizedDescription
        }
    }

    func toggle(_ id: Int) async {
        do {
            try await TodoService.toggle(id)
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }
}
