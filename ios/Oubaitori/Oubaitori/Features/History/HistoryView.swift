import SwiftUI

struct HistoryBundle: Decodable {
    let incomes: [IncomeRow]?
    let weights: [WeightRow]?
    let travels: [TravelRow]?
}

struct IncomeRow: Decodable, Identifiable {
    let id: Int
    let year: Int?
    let amount: Double?
    var label: String { "\(year ?? 0): \(Int(amount ?? 0))" }
}

struct WeightRow: Decodable, Identifiable {
    let id: Int
    let date: String?
    let kg: Double?
    var label: String { "\(date ?? "") — \(kg ?? 0) кг" }
}

struct TravelRow: Decodable, Identifiable {
    let id: Int
    let country: String?
    let city: String?
    let date: String?
    var label: String { [country, city, date].compactMap { $0 }.joined(separator: ", ") }
}

struct HistoryView: View {
    @State private var bundle: HistoryBundle?

    var body: some View {
        List {
            if let incomes = bundle?.incomes, !incomes.isEmpty {
                Section("Доходы") {
                    ForEach(incomes) { Text($0.label).foregroundStyle(DesignTokens.Colors.textPrimary) }
                }
            }
            if let weights = bundle?.weights, !weights.isEmpty {
                Section("Вес") {
                    ForEach(weights) { Text($0.label).foregroundStyle(DesignTokens.Colors.textPrimary) }
                }
            }
            if let travels = bundle?.travels, !travels.isEmpty {
                Section("Поездки") {
                    ForEach(travels) { Text($0.label).foregroundStyle(DesignTokens.Colors.textPrimary) }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .obScreenBackground(showPetals: false)
        .navigationTitle("История")
        .task {
            bundle = try? await APIClient.shared.request("GET", path: "history")
        }
    }
}
