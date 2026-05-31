import Foundation

enum GoalType: String, Codable, CaseIterable, Identifiable {
    case task
    case build_up
    case reduce
    case habit

    var id: String { rawValue }

    var emoji: String {
        switch self {
        case .task: return "✅"
        case .build_up: return "📈"
        case .reduce: return "📉"
        case .habit: return "🔁"
        }
    }

    var label: String {
        switch self {
        case .task: return "Выполнить"
        case .build_up: return "Прибавить"
        case .reduce: return "Избавиться"
        case .habit: return "Привычка"
        }
    }

    var isNumeric: Bool { self == .build_up || self == .reduce }
}

struct GoalDTO: Codable, Identifiable {
    let id: Int
    let title: String
    let goal_type: String?
    let target: Double?
    let last_value: Double?
    let unit: String?
    let direction: String?
    let icon: String?
    let start_value: Double?
    let target_date: String?
    let is_completed: Bool?
    let period_count: Double?
    let streak: Double?
    let last_date: String?

    var type: GoalType { GoalType(rawValue: goal_type ?? "build_up") ?? .build_up }
    var resolvedIcon: String { (icon?.isEmpty == false ? icon : nil) ?? GoalIcon.derive(title) }
    var completed: Bool { is_completed ?? false }

    var progress: Double {
        let t = target ?? 0
        switch type {
        case .task:
            return completed ? 1 : 0
        case .habit:
            guard t > 0 else { return 0 }
            return min(1, max(0, (period_count ?? 0) / t))
        case .reduce:
            guard let v = last_value else { return 0 }
            if v <= t { return 1 }
            let s = start_value ?? v
            guard s > t else { return 0 }
            return min(1, max(0, (s - v) / (s - t)))
        case .build_up:
            guard t > 0, let v = last_value else { return 0 }
            let s = start_value ?? 0
            guard t > s else { return v >= t ? 1 : 0 }
            return min(1, max(0, (v - s) / (t - s)))
        }
    }
}

struct GoalCheckinBody: Encodable {
    let value: Double
    let did_something: Int?
    let note: String?
    let date: String?
}

struct CreateGoalBody: Encodable {
    let title: String
    let goal_type: String
    let target: Double
    let unit: String
    let start_value: Double?
    let target_date: String?
}

struct UpdateGoalBody: Encodable {
    let title: String?
    let goal_type: String?
    let target: Double?
    let unit: String?
    let start_value: Double?
    let target_date: String?
    let is_completed: Bool?
}
