import Foundation

@MainActor
final class PushDeepLinkRouter: ObservableObject {
    static let shared = PushDeepLinkRouter()

    @Published var selectedTab = 0
    @Published var showMedications = false
    @Published var showWorkouts = false
    @Published var workoutPlanId: Int?
    @Published var showFinanceAddExpense = false

    private init() {}

    func handle(userInfo: [AnyHashable: Any]) {
        let screen = stringValue(userInfo["screen"])
        let entityId = intValue(userInfo["entityId"])

        switch screen {
        case "medications":
            selectedTab = 4
            showMedications = true
        case "workout":
            selectedTab = 4
            workoutPlanId = entityId
            showWorkouts = true
        case "finance":
            selectedTab = 2
            showFinanceAddExpense = true
        default:
            break
        }
    }

    func clearMedications() { showMedications = false }
    func clearWorkouts() {
        showWorkouts = false
        workoutPlanId = nil
    }
    func clearFinanceAdd() { showFinanceAddExpense = false }

    private func stringValue(_ value: Any?) -> String? {
        if let s = value as? String { return s }
        if let n = value as? NSString { return n as String }
        return nil
    }

    private func intValue(_ value: Any?) -> Int? {
        if let n = value as? Int { return n }
        if let n = value as? NSNumber { return n.intValue }
        if let s = value as? String { return Int(s) }
        return nil
    }
}
