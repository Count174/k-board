import Foundation
import Combine

@MainActor
final class GoalsViewModel: ObservableObject {
    @Published var goals: [GoalDTO] = []
    @Published var error: String?
    @Published var checkinValue = ""
    @Published var selectedGoal: GoalDTO?

    func load() async {
        do {
            goals = try await APIClient.shared.request("GET", path: "goals")
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
