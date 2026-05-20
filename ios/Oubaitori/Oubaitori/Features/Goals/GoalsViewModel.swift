import Foundation
import Combine

@MainActor
final class GoalsViewModel: ObservableObject {
    @Published var goals: [GoalDTO] = []
    @Published var error: String?
    @Published var checkinValue = ""
    @Published var selectedGoal: GoalDTO?
    @Published var showAddGoal = false
    @Published var newTitle = ""
    @Published var newTarget = ""
    @Published var newUnit = ""

    func load() async {
        do {
            goals = try await APIClient.shared.request("GET", path: "goals")
        } catch let err {
            error = err.localizedDescription
        }
    }

    func createGoal() async {
        let title = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, let target = Double(newTarget.replacingOccurrences(of: ",", with: ".")) else {
            error = "Укажите название и целевое значение"
            return
        }
        do {
            let _: GoalDTO = try await APIClient.shared.request(
                "POST",
                path: "goals",
                body: CreateGoalBody(
                    title: title,
                    target: target,
                    unit: newUnit.trimmingCharacters(in: .whitespaces),
                    direction: "increase",
                    image: "goal-01"
                )
            )
            newTitle = ""
            newTarget = ""
            newUnit = ""
            showAddGoal = false
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }

    func submitCheckin() async {
        guard let g = selectedGoal, let v = Double(checkinValue.replacingOccurrences(of: ",", with: ".")) else { return }
        do {
            try await APIClient.shared.requestVoid(
                "POST",
                path: "goals/\(g.id)/checkins",
                body: GoalCheckinBody(value: v, note: nil, date: nil)
            )
            checkinValue = ""
            selectedGoal = nil
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }
}
