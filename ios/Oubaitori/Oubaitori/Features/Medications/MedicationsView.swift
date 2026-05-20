import SwiftUI

struct MedicationDTO: Codable, Identifiable {
    let id: Int
    let name: String
    let dosage: String?
    let times: [String]?
    let active: Int?
}

struct MedicationIntakeDTO: Codable {
    let medication_id: Int
    let intake_time: String?
    let status: String?
}

struct MedicationIntakeBody: Encodable {
    let id: Int
    let status: String
    let intake_time: String?
}

struct MedicationsView: View {
    @State private var items: [MedicationDTO] = []
    @State private var takenIds: Set<Int> = []

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

            OBKanjiBadge(character: "薬", color: DesignTokens.Colors.accent)
                .padding(.top, 8)
                .padding(.trailing, DesignTokens.Spacing.lg)
        }
        .obScreenBackground(showPetals: false)
        .navigationTitle("Лекарства")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .refreshable { await load() }
    }

    private var activeMeds: [MedicationDTO] {
        items.filter { ($0.active ?? 1) == 1 }
    }

    private var progressHeader: some View {
        let total = max(activeMeds.count, 1)
        let done = activeMeds.filter { takenIds.contains($0.id) }.count
        return OBCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("\(done) из \(activeMeds.count) принято сегодня")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                OBLinearProgress(value: Double(done) / Double(total))
            }
        }
    }

    private func medCard(_ m: MedicationDTO) -> some View {
        let taken = takenIds.contains(m.id)
        return OBCard {
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
                Button {
                    Task { await toggleTaken(m) }
                } label: {
                    Image(systemName: taken ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(taken ? DesignTokens.Colors.accent : DesignTokens.Colors.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func load() async {
        items = (try? await APIClient.shared.request("GET", path: "medications") as [MedicationDTO]) ?? []
        let intakes: [MedicationIntakeDTO] = (try? await APIClient.shared.request("GET", path: "medications/intakes/today")) ?? []
        takenIds = Set(intakes.filter { $0.status == "taken" }.map(\.medication_id))
    }

    private func toggleTaken(_ m: MedicationDTO) async {
        let wasTaken = takenIds.contains(m.id)
        if wasTaken {
            takenIds.remove(m.id)
            _ = try? await APIClient.shared.requestVoid(
                "POST",
                path: "medications/intake",
                body: MedicationIntakeBody(id: m.id, status: "skipped", intake_time: m.times?.first),
                authorized: true
            )
        } else {
            takenIds.insert(m.id)
            _ = try? await APIClient.shared.requestVoid(
                "POST",
                path: "medications/intake",
                body: MedicationIntakeBody(id: m.id, status: "taken", intake_time: m.times?.first),
                authorized: true
            )
        }
        await load()
    }
}
