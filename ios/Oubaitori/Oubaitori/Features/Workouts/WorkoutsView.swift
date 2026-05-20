import SwiftUI

struct WorkoutPlanDTO: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let sport_label: String?
    let weekdays: [Int]?
    let exercises: [WorkoutExerciseDTO]?

    static func == (lhs: WorkoutPlanDTO, rhs: WorkoutPlanDTO) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct WorkoutExerciseDTO: Codable {
    let name: String
    let kind: String?
    let sets: Int?
    let reps: String?
    let sets_detail: String?
}

struct WorkoutsView: View {
    @State private var plans: [WorkoutPlanDTO] = []

    var body: some View {
        ScrollView {
            LazyVStack(spacing: DesignTokens.Spacing.md) {
                ForEach(plans) { p in
                    NavigationLink(value: p) {
                        OBCard {
                            HStack {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(p.name)
                                        .font(DesignTokens.Typography.headline)
                                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                                    if let label = p.sport_label {
                                        Text(label)
                                            .font(DesignTokens.Typography.caption)
                                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                                    }
                                    Text("\(p.exercises?.count ?? 0) упр.")
                                        .font(DesignTokens.Typography.caption)
                                        .foregroundStyle(DesignTokens.Colors.accent)
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(DesignTokens.Colors.textTertiary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(DesignTokens.Spacing.md)
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle("Тренировки")
        .navigationDestination(for: WorkoutPlanDTO.self) { plan in
            WorkoutPlanDetailView(planId: plan.id)
        }
        .task {
            plans = (try? await APIClient.shared.request("GET", path: "workouts/plans") as [WorkoutPlanDTO]) ?? []
        }
    }
}
