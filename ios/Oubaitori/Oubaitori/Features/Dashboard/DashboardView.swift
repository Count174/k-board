import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var auth: AuthRepository
    @StateObject private var vm = DashboardViewModel()

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topTrailing) {
                ScrollView {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                        greetingHeader

                        gardenCard

                        if let workout = vm.workoutLine {
                            OBCard {
                                Label(workout, systemImage: "figure.strengthtraining.traditional")
                                    .font(DesignTokens.Typography.callout)
                                    .foregroundStyle(DesignTokens.Colors.textPrimary)
                            }
                        }

                        tasksSection

                        budgetSection

                        if let error = vm.error {
                            Text(error)
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.danger)
                        }
                    }
                    .padding(DesignTokens.Spacing.md)
                }

                VStack {
                    OBKanjiWatermark(text: "今日")
                        .padding(.top, 8)
                    Spacer()
                }
                .padding(.trailing, DesignTokens.Spacing.lg)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    profileAvatar
                }
            }
            .refreshable { await vm.load() }
            .task { await vm.load() }
        }
    }

    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greeting)
                .font(DesignTokens.Typography.largeTitle)
                .foregroundStyle(DesignTokens.Colors.textPrimary)
            Text(formattedDate)
                .font(DesignTokens.Typography.callout)
                .foregroundStyle(DesignTokens.Colors.textSecondary)
        }
    }

    private var gardenCard: some View {
        let bloomed = vm.goals.filter { $0.progress >= 1 }.count
        let total = max(vm.goals.count, 1)
        let ratio = Double(bloomed) / Double(total)

        return OBCard(glow: true) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Сад сегодня")
                    .font(DesignTokens.Typography.captionBold)
                    .foregroundStyle(DesignTokens.Colors.accent)

                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(bloomed)")
                        .font(DesignTokens.Typography.metricLarge)
                        .foregroundStyle(DesignTokens.Colors.accent)
                    Text("/ \(vm.goals.count)")
                        .font(DesignTokens.Typography.title2)
                        .foregroundStyle(DesignTokens.Colors.textSecondary)
                }

                Text("целей расцвели сегодня")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)

                OBLinearProgress(value: ratio)
                    .padding(.top, 4)
            }
        }
    }

    private var tasksSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Следующие задачи")
                .font(DesignTokens.Typography.headline)
                .foregroundStyle(DesignTokens.Colors.textPrimary)

            if vm.todos.isEmpty {
                Text("Нет активных задач")
                    .font(DesignTokens.Typography.callout)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
            } else {
                ForEach(vm.todos) { t in
                    HStack(spacing: 12) {
                        Circle()
                            .stroke(DesignTokens.Colors.textTertiary, lineWidth: 1.5)
                            .frame(width: 22, height: 22)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(t.text)
                                .font(DesignTokens.Typography.body)
                                .foregroundStyle(DesignTokens.Colors.textPrimary)
                            OBCategoryPill(title: "Личное", color: DesignTokens.Colors.categoryPersonal)
                        }
                        Spacer()
                        if let time = t.time {
                            Text(time)
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textSecondary)
                        }
                    }
                    .padding(DesignTokens.Spacing.md)
                    .background(DesignTokens.Colors.card)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
                }
            }
        }
    }

    private var budgetSection: some View {
        OBCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Бюджет недели")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                Text(formatMoney(vm.balance))
                    .font(DesignTokens.Typography.title)
                    .foregroundStyle(DesignTokens.Colors.textPrimary)
                // Placeholder sparkline
                RoundedRectangle(cornerRadius: 4)
                    .fill(DesignTokens.Gradients.mintChartFill)
                    .frame(height: 56)
                    .overlay(
                        Path { path in
                            path.move(to: CGPoint(x: 0, y: 40))
                            path.addCurve(
                                to: CGPoint(x: 200, y: 12),
                                control1: CGPoint(x: 60, y: 50),
                                control2: CGPoint(x: 120, y: 0)
                            )
                        }
                        .stroke(DesignTokens.Colors.accent, lineWidth: 2)
                    )
            }
        }
    }

    private var profileAvatar: some View {
        Circle()
            .fill(DesignTokens.Colors.accentDim)
            .frame(width: 36, height: 36)
            .overlay(
                Text(String(auth.currentUser?.name.prefix(1) ?? "?"))
                    .font(DesignTokens.Typography.captionBold)
                    .foregroundStyle(DesignTokens.Colors.accent)
            )
            .overlay(Circle().stroke(DesignTokens.Colors.accent.opacity(0.5), lineWidth: 1))
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let base: String
        switch hour {
        case 5..<12: base = "Доброе утро"
        case 12..<17: base = "Добрый день"
        case 17..<23: base = "Добрый вечер"
        default: base = "Доброй ночи"
        }
        if let name = auth.currentUser?.name.split(separator: " ").first {
            return "\(base), \(name)"
        }
        return base
    }

    private var formattedDate: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "EEEE, d MMMM"
        return f.string(from: Date()).capitalized
    }

    private func formatMoney(_ v: Double) -> String {
        let n = Int(v.rounded())
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = " "
        return (f.string(from: NSNumber(value: abs(n))) ?? "0") + " ₽"
    }
}
