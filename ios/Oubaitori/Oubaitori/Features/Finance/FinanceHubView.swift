import SwiftUI

struct FinanceHubView: View {
    @EnvironmentObject private var deepLink: PushDeepLinkRouter
    @State private var balance: Double = 0
    @State private var incomes: Double = 0
    @State private var expenses: Double = 0
    @State private var showAddTx = false
    @State private var addTxType = "expense"

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topTrailing) {
                ScrollView {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                        balanceCard
                        incomeExpenseRow

                        HStack(spacing: DesignTokens.Spacing.sm) {
                            Button {
                                addTxType = "expense"
                                showAddTx = true
                            } label: {
                                Label("Расход", systemImage: "minus.circle.fill")
                                    .font(DesignTokens.Typography.callout.weight(.medium))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(DesignTokens.Colors.coral.opacity(0.15))
                                    .foregroundStyle(DesignTokens.Colors.coral)
                                    .clipShape(Capsule())
                            }
                            Button {
                                addTxType = "income"
                                showAddTx = true
                            } label: {
                                Label("Доход", systemImage: "plus.circle.fill")
                                    .font(DesignTokens.Typography.callout.weight(.medium))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(DesignTokens.Colors.accentDim)
                                    .foregroundStyle(DesignTokens.Colors.accent)
                                    .clipShape(Capsule())
                            }
                        }

                        NavigationLink {
                            BudgetView()
                        } label: {
                            navRow(title: "Бюджет по категориям", icon: "chart.pie")
                        }
                        NavigationLink {
                            LoansView()
                        } label: {
                            navRow(title: "Кредиты", icon: "building.columns")
                        }
                    }
                    .padding(DesignTokens.Spacing.md)
                }

                OBKanjiBadge(character: "財")
                    .padding(.top, 8)
                    .padding(.trailing, DesignTokens.Spacing.lg)
            }
            .navigationTitle("Финансы")
            .navigationBarTitleDisplayMode(.large)
            .task { await load() }
            .refreshable { await load() }
            .sheet(isPresented: $showAddTx) {
                AddTransactionSheet(initialType: addTxType) { await load() }
            }
            .onChange(of: deepLink.showFinanceAddExpense) { _, show in
                if show {
                    addTxType = "expense"
                    showAddTx = true
                    deepLink.clearFinanceAdd()
                }
            }
        }
    }

    private var balanceCard: some View {
        OBCard(borderColor: DesignTokens.Colors.sakura.opacity(0.25), glow: true) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Баланс месяца")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                Text(formatMoney(balance, showSign: true))
                    .font(DesignTokens.Typography.metricLarge)
                    .foregroundStyle(DesignTokens.Colors.sakuraSoft)
                RoundedRectangle(cornerRadius: 8)
                    .fill(DesignTokens.Gradients.mintChartFill)
                    .frame(height: 72)
                    .overlay(chartLine)
            }
        }
    }

    private var chartLine: some View {
        Path { path in
            path.move(to: CGPoint(x: 8, y: 50))
            path.addCurve(
                to: CGPoint(x: 280, y: 18),
                control1: CGPoint(x: 80, y: 58),
                control2: CGPoint(x: 160, y: 8)
            )
        }
        .stroke(DesignTokens.Colors.accent, lineWidth: 2)
    }

    private var incomeExpenseRow: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            miniStat(title: "Доходы", value: incomes, positive: true)
            miniStat(title: "Расходы", value: expenses, positive: false)
        }
    }

    private func miniStat(title: String, value: Double, positive: Bool) -> some View {
        OBCard {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                Text(formatMoney(value, showSign: positive))
                    .font(DesignTokens.Typography.headline)
                    .foregroundStyle(positive ? DesignTokens.Colors.accent : DesignTokens.Colors.coral)
            }
        }
    }

    private func navRow(title: String, icon: String) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(DesignTokens.Colors.accent)
            Text(title)
                .font(DesignTokens.Typography.body)
                .foregroundStyle(DesignTokens.Colors.textPrimary)
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(DesignTokens.Colors.textTertiary)
        }
        .padding(DesignTokens.Spacing.md)
        .background(DesignTokens.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
    }

    private func load() async {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        let now = Date()
        let cal = Calendar.current
        let start = cal.date(from: cal.dateComponents([.year, .month], from: now))!
        let path = "finances/summary?start=\(fmt.string(from: start))&end=\(fmt.string(from: now))"
        if let s: FinanceSummaryDTO = try? await APIClient.shared.request("GET", path: path) {
            balance = s.balance ?? 0
            incomes = s.incomes ?? 0
            expenses = s.expenses ?? 0
        }
    }

    private func formatMoney(_ v: Double, showSign: Bool = false) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        let n = f.string(from: NSNumber(value: abs(v))) ?? "0"
        if showSign && v >= 0 { return "+ \(n) ₽" }
        return "\(n) ₽"
    }
}
