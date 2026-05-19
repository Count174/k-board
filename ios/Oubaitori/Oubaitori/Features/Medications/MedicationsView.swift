import SwiftUI

struct MedicationDTO: Codable, Identifiable {
    let id: Int
    let name: String
    let dosage: String?
    let times: [String]?
    let active: Int?
}

struct MedicationsView: View {
    @State private var items: [MedicationDTO] = []

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    progressHeader
                    Text("Сегодня")
                        .font(DesignTokens.Typography.headline)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                    ForEach(activeMeds) { m in
                        medCard(m)
                    }
                }
                .padding(DesignTokens.Spacing.md)
            }

            HStack(spacing: 8) {
                OBKanjiBadge(character: "薬", color: DesignTokens.Colors.accent)
            }
            .padding(.top, 8)
            .padding(.trailing, DesignTokens.Spacing.lg)
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle("Лекарства")
        .navigationBarTitleDisplayMode(.large)
        .task {
            items = (try? await APIClient.shared.request("GET", path: "medications") as [MedicationDTO]) ?? []
        }
    }

    private var activeMeds: [MedicationDTO] {
        items.filter { ($0.active ?? 1) == 1 }
    }

    private var progressHeader: some View {
        OBCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("1 из \(max(activeMeds.count, 1)) принято сегодня")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                OBLinearProgress(value: activeMeds.isEmpty ? 0 : 0.25)
            }
        }
    }

    private func medCard(_ m: MedicationDTO) -> some View {
        OBCard {
            HStack(spacing: 12) {
                Circle()
                    .fill(DesignTokens.Colors.coral.opacity(0.25))
                    .frame(width: 44, height: 44)
                    .overlay(Image(systemName: "pills.fill").foregroundStyle(DesignTokens.Colors.coral))
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.name)
                        .font(DesignTokens.Typography.headline)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                    if let d = m.dosage {
                        Text(d)
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                    if let t = m.times, let first = t.first {
                        Text(first)
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.accent)
                    }
                }
                Spacer()
                Circle()
                    .stroke(DesignTokens.Colors.accent, lineWidth: 2)
                    .frame(width: 28, height: 28)
            }
        }
    }
}
