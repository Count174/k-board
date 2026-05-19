import SwiftUI

struct WorkoutPlanDTO: Codable, Identifiable {
    let id: Int
    let name: String
    let sport_label: String?
    let weekdays: [Int]?
    let exercises: [WorkoutExerciseDTO]?
}

struct WorkoutExerciseDTO: Codable {
    let name: String
    let kind: String?
}

struct WorkoutsView: View {
    @State private var plans: [WorkoutPlanDTO] = []

    var body: some View {
        ScrollView {
            LazyVStack(spacing: DesignTokens.Spacing.md) {
                ForEach(plans) { p in
                    OBCard {
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
                    }
                }
            }
            .padding(DesignTokens.Spacing.md)
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle("Тренировки")
        .task {
            plans = (try? await APIClient.shared.request("GET", path: "workouts/plans") as [WorkoutPlanDTO]) ?? []
        }
    }
}
