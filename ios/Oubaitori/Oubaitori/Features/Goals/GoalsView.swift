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
            ZStack(alignment: .bottomTrailing) {
                ScrollView {
                    LazyVStack(spacing: DesignTokens.Spacing.md) {
                        ForEach(Array(vm.goals.enumerated()), id: \.element.id) { index, g in
                            goalCard(g, color: goalColors[index % goalColors.count])
                        }
                    }
                    .padding(DesignTokens.Spacing.md)
                    .padding(.bottom, 88)
                }

                OBFloatingAddButton { vm.showAddGoal = true }
                    .padding(.trailing, DesignTokens.Spacing.md)
                    .padding(.bottom, DesignTokens.Spacing.md)
            }
            .navigationTitle("Цели")
            .navigationBarTitleDisplayMode(.large)
            .task { await vm.load() }
            .refreshable { await vm.load() }
            .sheet(item: $vm.selectedGoal) { g in
                checkinSheet(g)
            }
            .sheet(isPresented: $vm.showAddGoal) {
                addGoalSheet
            }
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

    private var addGoalSheet: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.md) {
                OBTextField(placeholder: "Название цели", text: $vm.newTitle)
                OBTextField(placeholder: "Целевое значение", text: $vm.newTarget)
                    .keyboardType(.decimalPad)
                OBTextField(placeholder: "Единица (кг, ₽, книг…)", text: $vm.newUnit)
                if let error = vm.error {
                    Text(error)
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.danger)
                }
                OBButton(title: "Сохранить", horizontalPadding: DesignTokens.Spacing.lg) {
                    Task { await vm.createGoal() }
                }
                .padding(.horizontal, DesignTokens.Spacing.md)
                Spacer()
            }
            .padding(DesignTokens.Spacing.lg)
            .obScreenBackground(showPetals: false)
            .navigationTitle("Новая цель")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { vm.showAddGoal = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func checkinSheet(_ g: GoalDTO) -> some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.md) {
                Text(g.title)
                    .font(DesignTokens.Typography.headline)
                OBTextField(placeholder: "Текущее значение", text: $vm.checkinValue)
                    .keyboardType(.decimalPad)
                OBButton(title: "Сохранить", horizontalPadding: DesignTokens.Spacing.lg) {
                    Task { await vm.submitCheckin() }
                }
                .padding(.horizontal, DesignTokens.Spacing.md)
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
