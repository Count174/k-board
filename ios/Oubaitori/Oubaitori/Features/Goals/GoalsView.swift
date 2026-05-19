import SwiftUI

struct GoalsView: View {
    @StateObject private var vm = GoalsViewModel()

    private let goalColors: [Color] = [
        DesignTokens.Colors.goalFinance,
        DesignTokens.Colors.goalEducation,
        DesignTokens.Colors.goalHealth,
    ]

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topTrailing) {
                ScrollView {
                    LazyVStack(spacing: DesignTokens.Spacing.md) {
                        ForEach(Array(vm.goals.enumerated()), id: \.element.id) { index, g in
                            goalCard(g, color: goalColors[index % goalColors.count])
                        }
                    }
                    .padding(DesignTokens.Spacing.md)
                }

                HStack(spacing: 8) {
                    OBKanjiBadge(character: "目")
                    addButton
                }
                .padding(.top, 4)
                .padding(.trailing, DesignTokens.Spacing.md)
            }
            .navigationTitle("Цели")
            .navigationBarTitleDisplayMode(.large)
            .task { await vm.load() }
            .refreshable { await vm.load() }
            .sheet(item: $vm.selectedGoal) { g in
                checkinSheet(g)
            }
        }
    }

    private var addButton: some View {
        Button {} label: {
            Image(systemName: "plus")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color(hex: 0x0A1F18))
                .frame(width: 44, height: 44)
                .background(DesignTokens.Colors.accent)
                .clipShape(Circle())
        }
    }

    private func goalCard(_ g: GoalDTO, color: Color) -> some View {
        OBCard {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                OBCircularProgress(
                    progress: g.progress,
                    tint: color,
                    label: "\(Int(g.progress * 100))%"
                )
                .frame(width: 56, height: 56)

                VStack(alignment: .leading, spacing: 6) {
                    Text(g.title)
                        .font(DesignTokens.Typography.headline)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                    Text(progressLabel(g))
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(color)
                }
                Spacer()
            }
        }
        .onTapGesture { vm.selectedGoal = g }
    }

    private func progressLabel(_ g: GoalDTO) -> String {
        let v = Int(g.last_value ?? 0)
        let t = Int(g.target ?? 0)
        let u = g.unit ?? ""
        return "\(v) / \(t) \(u)"
    }

    private func checkinSheet(_ g: GoalDTO) -> some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.md) {
                Text(g.title)
                    .font(DesignTokens.Typography.headline)
                OBTextField(placeholder: "Текущее значение", text: $vm.checkinValue)
                    .keyboardType(.decimalPad)
                OBButton(title: "Сохранить") {
                    Task { await vm.submitCheckin() }
                }
                Spacer()
            }
            .padding(DesignTokens.Spacing.lg)
            .obScreenBackground(showPetals: false)
            .navigationTitle("Чек-ин")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { vm.selectedGoal = nil }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

extension GoalDTO: Hashable {
    static func == (lhs: GoalDTO, rhs: GoalDTO) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
