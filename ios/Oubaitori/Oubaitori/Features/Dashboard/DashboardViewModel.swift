import Foundation
import Combine

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var goals: [GoalDTO] = []
    @Published var todos: [TodoDTO] = []
    @Published var balance: Double = 0
    @Published var workoutLine: String?
    @Published var error: String?
    @Published var loading = false
    @Published var undoToast: UndoToast?

    func load() async {
        loading = true
        error = nil
        defer { loading = false }

        let cal = Calendar.current
        let now = Date()
        let monthStart = cal.date(from: cal.dateComponents([.year, .month], from: now))!
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        let start = fmt.string(from: monthStart)
        let end = fmt.string(from: now)

        var wd = cal.component(.weekday, from: now)
        if wd == 1 { wd = 7 } else { wd -= 1 }
        let monday = cal.date(byAdding: .day, value: -(wd - 1), to: now)!
        let wStart = fmt.string(from: monday)
        let wEnd = fmt.string(from: cal.date(byAdding: .day, value: 6, to: monday)!)

        do {
            async let goalsReq: [GoalDTO] = APIClient.shared.request("GET", path: "goals")
            async let todosReq: [TodoDTO] = APIClient.shared.request("GET", path: "todos")
            async let summaryReq: FinanceSummaryDTO = APIClient.shared.request(
                "GET",
                path: "finances/summary?start=\(start)&end=\(end)"
            )
            async let scoreReq: ScoreResponseDTO = APIClient.shared.request(
                "GET",
                path: "analytics/score?start=\(wStart)&end=\(wEnd)"
            )

            let (g, t, s, sc) = try await (goalsReq, todosReq, summaryReq, scoreReq)
            goals = g
            todos = t.filter { !$0.isCompleted }.prefix(5).map { $0 }
            balance = s.balance ?? 0

            if let w = sc.breakdown?.health?.workouts, w.planned ?? 0 > 0 {
                let rate = w.on_track == true ? "молодец" : "\(w.completed ?? 0)/\(w.planned ?? 0)"
                workoutLine = "Тренировки: \(rate)"
            } else {
                workoutLine = nil
            }
        } catch let err {
            self.error = err.localizedDescription
        }
    }

    func completeTodo(_ todo: TodoDTO) async {
        guard !todo.isCompleted else { return }
        let title = todo.text
        do {
            try await TodoService.toggle(todo.id)
            await load()
            undoToast = UndoToast(message: "«\(title)» выполнена", undoTitle: "Отменить") { [weak self] in
                Task { await self?.undoTodo(todo.id) }
            }
        } catch let err {
            error = err.localizedDescription
        }
    }

    private func undoTodo(_ id: Int) async {
        try? await TodoService.toggle(id)
        await load()
    }
}

struct FinanceSummaryDTO: Decodable {
    let balance: Double?
    let incomes: Double?
    let expenses: Double?
}

struct ScoreResponseDTO: Decodable {
    struct Breakdown: Decodable {
        struct Health: Decodable {
            struct Workouts: Decodable {
                let planned: Int?
                let completed: Int?
                let on_track: Bool?
            }
            let workouts: Workouts?
        }
        let health: Health?
    }
    let breakdown: Breakdown?
}
