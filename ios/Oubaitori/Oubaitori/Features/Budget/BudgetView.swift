import SwiftUI

struct BudgetStatRow: Decodable, Identifiable {
    let rowId: Int?
    let category: String
    let budget: Double?
    let spent: Double?

    var id: String { rowId.map { "id-\($0)" } ?? "cat-\(category)" }

    enum CodingKeys: String, CodingKey {
        case rowId = "id"
        case category
        case budget
        case spent
    }
}

struct BudgetStatsResponse: Decodable {
    let items: [BudgetStatRow]?
}

struct BudgetView: View {
    @State private var items: [BudgetStatRow] = []

    private var spentRatio: Double {
        let totalB = items.reduce(0) { $0 + ($1.budget ?? 0) }
        let totalS = items.reduce(0) { $0 + ($1.spent ?? 0) }
        guard totalB > 0 else { return 0 }
        return min(1, totalS / totalB)
    }

    private var remaining: Double {
        let totalB = items.reduce(0) { $0 + ($1.budget ?? 0) }
        let totalS = items.reduce(0) { $0 + ($1.spent ?? 0) }
        return max(0, totalB - totalS)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.lg) {
                ringSummary
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("По категориям")
                        .font(DesignTokens.Typography.headline)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                    ForEach(Array(items.enumerated()), id: \.element.id) { idx, row in
                        categoryRow(row, color: categoryColor(idx))
                    }
                }
            }
            .padding(DesignTokens.Spacing.md)
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle("Бюджет")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
    }

    private var ringSummary: some View {
        OBCard(glow: true) {
            VStack(spacing: DesignTokens.Spacing.md) {
                ZStack {
                    OBCircularProgress(progress: spentRatio, lineWidth: 10, tint: DesignTokens.Colors.accent)
                        .frame(width: 140, height: 140)
                    VStack(spacing: 4) {
                        Text("\(Int(spentRatio * 100))%")
                            .font(DesignTokens.Typography.metricLarge)
                            .foregroundStyle(DesignTokens.Colors.textPrimary)
                        Text("израсходовано")
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                }
                Text("\(Int(remaining)) ₽ осталось")
                    .font(DesignTokens.Typography.callout)
                    .foregroundStyle(DesignTokens.Colors.accent)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func categoryRow(_ row: BudgetStatRow, color: Color) -> some View {
        let b = row.budget ?? 0
        let s = row.spent ?? 0
        let ratio = b > 0 ? min(1, s / b) : 0
        return OBCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(row.category)
                        .font(DesignTokens.Typography.body)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                    Spacer()
                    Text("\(Int(s)) / \(Int(b)) ₽")
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.textSecondary)
                }
                OBLinearProgress(value: ratio, tint: color)
            }
        }
    }

    private func categoryColor(_ index: Int) -> Color {
        let colors: [Color] = [
            DesignTokens.Colors.categoryPersonal,
            DesignTokens.Colors.coral,
            DesignTokens.Colors.categoryEntertainment,
            DesignTokens.Colors.categoryWork,
            DesignTokens.Colors.categoryTransport,
            DesignTokens.Colors.categoryOther,
        ]
        return colors[index % colors.count]
    }

    private func load() async {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM"
        let month = fmt.string(from: Date())
        if let res: BudgetStatsResponse = try? await APIClient.shared.request(
            "GET",
            path: "budgets/stats?month=\(month)"
        ) {
            items = res.items ?? []
        }
    }
}
