import SwiftUI

struct WorkoutPlanDetailView: View {
    let planId: Int
    @State private var plan: WorkoutPlanDTO?
    @State private var error: String?

    var body: some View {
        ScrollView {
            if let plan {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    if let label = plan.sport_label {
                        Text(label)
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                    if let days = plan.weekdays, !days.isEmpty {
                        Text(weekdaysLabel(days))
                            .font(DesignTokens.Typography.callout)
                            .foregroundStyle(DesignTokens.Colors.accent)
                    }

                    Text("Упражнения")
                        .font(DesignTokens.Typography.headline)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                        .padding(.top, 8)

                    if let exercises = plan.exercises, !exercises.isEmpty {
                        ForEach(Array(exercises.enumerated()), id: \.offset) { idx, ex in
                            OBCard {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("\(idx + 1). \(ex.name)")
                                        .font(DesignTokens.Typography.headline)
                                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                                    if let kind = ex.kind, !kind.isEmpty {
                                        Text(kindLabel(kind))
                                            .font(DesignTokens.Typography.caption)
                                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                                    }
                                    if let detail = ex.sets_detail, !detail.isEmpty {
                                        Text(detail)
                                            .font(DesignTokens.Typography.callout)
                                            .foregroundStyle(DesignTokens.Colors.accent)
                                    } else if let sets = ex.sets, let reps = ex.reps {
                                        Text("\(sets) × \(reps)")
                                            .font(DesignTokens.Typography.callout)
                                            .foregroundStyle(DesignTokens.Colors.accent)
                                    }
                                }
                            }
                        }
                    } else {
                        Text("Упражнения не заданы")
                            .font(DesignTokens.Typography.callout)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                }
                .padding(DesignTokens.Spacing.md)
            } else if let error {
                Text(error)
                    .foregroundStyle(DesignTokens.Colors.danger)
                    .padding()
            } else {
                ProgressView()
                    .padding()
            }
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle(plan?.name ?? "План")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        do {
            plan = try await APIClient.shared.request("GET", path: "workouts/plans/\(planId)")
        } catch let err {
            error = err.localizedDescription
        }
    }

    private func weekdaysLabel(_ days: [Int]) -> String {
        let names = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        return days.compactMap { d in (1...7).contains(d) ? names[d] : nil }.joined(separator: ", ")
    }

    private func kindLabel(_ kind: String) -> String {
        switch kind {
        case "strength": return "Силовое"
        case "cardio": return "Кардио"
        case "mobility": return "Мобильность"
        default: return kind
        }
    }
}
