import SwiftUI

struct LoanDTO: Codable, Identifiable {
    let id: Int
    let name: String
    let bank: String?
    let monthly_payment: Double?
    let remaining_months: Int?
    let status: String?
}

struct LoansView: View {
    @State private var loans: [LoanDTO] = []

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.md) {
                    summaryCard
                    ForEach(loans) { loan in
                        loanRow(loan)
                    }
                }
                .padding(DesignTokens.Spacing.md)
            }

            OBKanjiBadge(character: "信", color: DesignTokens.Colors.coral)
                .padding(.top, 8)
                .padding(.trailing, DesignTokens.Spacing.lg)
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle("Кредиты")
        .navigationBarTitleDisplayMode(.large)
        .task {
            loans = (try? await APIClient.shared.request("GET", path: "loans") as [LoanDTO]) ?? []
        }
    }

    private var summaryCard: some View {
        OBCard(borderColor: DesignTokens.Colors.coral.opacity(0.4)) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Активные кредиты")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                Text("\(loans.count)")
                    .font(DesignTokens.Typography.metricLarge)
                    .foregroundStyle(DesignTokens.Colors.textPrimary)
                OBLinearProgress(value: 0.32, tint: DesignTokens.Colors.accent)
                Text("32% от общего долга")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
            }
        }
    }

    private func loanRow(_ loan: LoanDTO) -> some View {
        OBCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(loan.name)
                        .font(DesignTokens.Typography.headline)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                    if let bank = loan.bank {
                        Text(bank)
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                }
                Spacer()
                if let pay = loan.monthly_payment {
                    Text("\(Int(pay)) ₽")
                        .font(DesignTokens.Typography.callout)
                        .foregroundStyle(DesignTokens.Colors.coral)
                }
            }
        }
    }
}
