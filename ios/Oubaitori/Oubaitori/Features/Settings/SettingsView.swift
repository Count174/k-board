import SwiftUI

struct AccountDTO: Codable, Identifiable {
    let id: Int
    let name: String
    let currency: String?
    let is_primary: Int?
}

struct SettingsView: View {
    @State private var accounts: [AccountDTO] = []

    var body: some View {
        List {
            Section("Счета") {
                ForEach(accounts) { a in
                    HStack {
                        Text(a.name)
                            .foregroundStyle(DesignTokens.Colors.textPrimary)
                        Spacer()
                        Text(a.currency ?? "RUB")
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                    .listRowBackground(DesignTokens.Colors.card)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .obScreenBackground(showPetals: false)
        .navigationTitle("Настройки")
        .task {
            accounts = (try? await APIClient.shared.request("GET", path: "accounts") as [AccountDTO]) ?? []
        }
    }
}
