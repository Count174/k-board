import Foundation

struct GoalDTO: Codable, Identifiable {
    let id: Int
    let title: String
    let target: Double?
    let last_value: Double?
    let unit: String?
    let direction: String?

    var progress: Double {
        let t = target ?? 0
        let v = last_value ?? 0
        guard t > 0 else { return 0 }
        if direction == "decrease" {
            return min(1, max(0, t / max(1, v)))
        }
        return min(1, max(0, v / t))
    }
}

struct GoalCheckinBody: Encodable {
    let value: Double
    let note: String?
    let date: String?
}
