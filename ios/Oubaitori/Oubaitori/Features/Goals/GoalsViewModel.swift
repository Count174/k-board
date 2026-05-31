import Foundation
import Combine

@MainActor
final class GoalsViewModel: ObservableObject {
    @Published var goals: [GoalDTO] = []
    @Published var error: String?

    // check-in (числовые)
    @Published var checkinValue = ""
    @Published var selectedGoal: GoalDTO?

    // create/edit form
    @Published var showForm = false
    @Published var editingGoalId: Int?
    @Published var formType: GoalType = .build_up
    @Published var formTitle = ""
    @Published var formTarget = ""
    @Published var formUnit = ""
    @Published var formStart = ""
    @Published var formHasDate = false
    @Published var formDate = Date()

    var isEditing: Bool { editingGoalId != nil }

    var previewIcon: String { GoalIcon.derive(formTitle) }

    var activeGoals: [GoalDTO] { goals.filter { !$0.completed } }
    var completedGoals: [GoalDTO] { goals.filter { $0.completed } }

    private let isoDate: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    func load() async {
        do {
            goals = try await APIClient.shared.request("GET", path: "goals?include_completed=1")
        } catch let err {
            error = err.localizedDescription
        }
    }

    func startCreate() {
        editingGoalId = nil
        formType = .build_up
        formTitle = ""
        formTarget = ""
        formUnit = ""
        formStart = ""
        formHasDate = false
        formDate = Date()
        error = nil
        showForm = true
    }

    func startEdit(_ g: GoalDTO) {
        editingGoalId = g.id
        formType = g.type
        formTitle = g.title
        formTarget = g.type == .task ? "" : String(Int(g.target ?? 0))
        formUnit = g.unit ?? ""
        formStart = g.start_value == nil ? "" : String(Int(g.start_value ?? 0))
        if let d = g.target_date, let parsed = isoDate.date(from: d) {
            formHasDate = true
            formDate = parsed
        } else {
            formHasDate = false
            formDate = Date()
        }
        error = nil
        showForm = true
    }

    private func parseNumber(_ s: String) -> Double? {
        Double(s.replacingOccurrences(of: ",", with: "."))
    }

    func saveForm() async {
        let title = formTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            error = "Укажите название"
            return
        }

        let needsTarget = formType.isNumeric || formType == .habit
        var target: Double = 1
        if needsTarget {
            guard let t = parseNumber(formTarget) else {
                error = "Укажите целевое значение"
                return
            }
            target = t
        }

        let unit: String
        if formType == .habit {
            unit = formUnit.trimmingCharacters(in: .whitespaces).isEmpty ? "раз" : formUnit.trimmingCharacters(in: .whitespaces)
        } else {
            unit = formUnit.trimmingCharacters(in: .whitespaces)
        }

        let startVal: Double? = formType.isNumeric ? parseNumber(formStart) : nil
        let dateStr: String? = formHasDate ? isoDate.string(from: formDate) : nil

        do {
            if let id = editingGoalId {
                let _: GoalDTO = try await APIClient.shared.request(
                    "PATCH",
                    path: "goals/\(id)",
                    body: UpdateGoalBody(
                        title: title,
                        goal_type: formType.rawValue,
                        target: formType == .task ? 1 : target,
                        unit: unit,
                        start_value: startVal,
                        target_date: dateStr,
                        is_completed: nil
                    )
                )
            } else {
                let _: GoalDTO = try await APIClient.shared.request(
                    "POST",
                    path: "goals",
                    body: CreateGoalBody(
                        title: title,
                        goal_type: formType.rawValue,
                        target: formType == .task ? 1 : target,
                        unit: unit,
                        start_value: startVal,
                        target_date: dateStr
                    )
                )
            }
            showForm = false
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }

    func deleteGoal(_ g: GoalDTO) async {
        do {
            try await APIClient.shared.requestVoid("DELETE", path: "goals/\(g.id)")
            goals.removeAll { $0.id == g.id }
        } catch let err {
            error = err.localizedDescription
        }
    }

    func toggleTaskDone(_ g: GoalDTO) async {
        do {
            let _: GoalDTO = try await APIClient.shared.request(
                "PATCH",
                path: "goals/\(g.id)",
                body: UpdateGoalBody(title: nil, goal_type: nil, target: nil, unit: nil,
                                     start_value: nil, target_date: nil, is_completed: !g.completed)
            )
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }

    func markHabitToday(_ g: GoalDTO) async {
        do {
            try await APIClient.shared.requestVoid(
                "POST",
                path: "goals/\(g.id)/checkins",
                body: GoalCheckinBody(value: 1, did_something: 1, note: nil, date: isoDate.string(from: Date()))
            )
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }

    func submitCheckin() async {
        guard let g = selectedGoal, let v = parseNumber(checkinValue) else { return }
        do {
            try await APIClient.shared.requestVoid(
                "POST",
                path: "goals/\(g.id)/checkins",
                body: GoalCheckinBody(value: v, did_something: 1, note: nil, date: nil)
            )
            checkinValue = ""
            selectedGoal = nil
            await load()
        } catch let err {
            error = err.localizedDescription
        }
    }
}
