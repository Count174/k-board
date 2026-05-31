import SwiftUI

struct WorkoutsView: View {
    @State private var plans: [WorkoutPlanDTO] = []
    @State private var error: String?

    var body: some View {
        Group {
            if plans.isEmpty, error == nil {
                ProgressView()
            } else if plans.isEmpty {
                ContentUnavailableView(
                    "Нет планов",
                    systemImage: "figure.strengthtraining.traditional",
                    description: Text(error ?? "Создайте план в веб-версии")
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: DesignTokens.Spacing.md) {
                        ForEach(plans) { p in
                            NavigationLink {
                                WorkoutPlanDetailView(planId: p.id, planName: p.name)
                            } label: {
                                planCard(p)
                            }
                        }
                    }
                    .padding(DesignTokens.Spacing.md)
                }
            }
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle("Тренировки")
        .task { await load() }
        .refreshable { await load() }
    }

    private func planCard(_ p: WorkoutPlanDTO) -> some View {
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

    private func load() async {
        error = nil
        do {
            plans = try await APIClient.shared.request("GET", path: "workouts/plans")
        } catch let err {
            error = err.localizedDescription
            plans = []
        }
    }
}
