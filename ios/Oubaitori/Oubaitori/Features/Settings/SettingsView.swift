import SwiftUI

struct AccountDTO: Codable, Identifiable {
    let id: Int
    var name: String
    let currency: String?
    let is_primary: Int?
    var balance: Double?
    let bank_name: String?
}

struct CreateAccountBody: Encodable {
    let name: String
    let currency: String
    let balance: Double
    let bank_name: String?
}

struct UpdateAccountBody: Encodable {
    let name: String
    let currency: String
    let balance: Double
    let bank_name: String?
}

struct SettingsView: View {
    @State private var accounts: [AccountDTO] = []
    @State private var showAdd = false
    @State private var editing: AccountDTO?

    var body: some View {
        List {
            Section {
                ForEach(accounts) { a in
                    Button {
                        editing = a
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(a.name)
                                    .foregroundStyle(DesignTokens.Colors.textPrimary)
                                if let bank = a.bank_name, !bank.isEmpty {
                                    Text(bank)
                                        .font(DesignTokens.Typography.caption)
                                        .foregroundStyle(DesignTokens.Colors.textSecondary)
                                }
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(formatBalance(a))
                                    .font(DesignTokens.Typography.callout)
                                    .foregroundStyle(DesignTokens.Colors.accent)
                                Text(a.currency ?? "RUB")
                                    .font(DesignTokens.Typography.caption)
                                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                            }
                            if (a.is_primary ?? 0) == 1 {
                                Text("основной")
                                    .font(DesignTokens.Typography.caption)
                                    .foregroundStyle(DesignTokens.Colors.sakura)
                            }
                        }
                    }
                    .listRowBackground(DesignTokens.Colors.card)
                }
            } header: {
                HStack {
                    Text("Счета")
                    Spacer()
                    Button {
                        showAdd = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(DesignTokens.Colors.accent)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .obScreenBackground(showPetals: false)
        .navigationTitle("Настройки")
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showAdd) {
            AccountEditorSheet(mode: .create) { await load() }
        }
        .sheet(item: $editing) { account in
            AccountEditorSheet(mode: .edit(account)) { await load() }
        }
    }

    private func load() async {
        accounts = (try? await APIClient.shared.request("GET", path: "accounts") as [AccountDTO]) ?? []
    }

    private func formatBalance(_ a: AccountDTO) -> String {
        let v = a.balance ?? 0
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        return (f.string(from: NSNumber(value: v)) ?? "0") + " ₽"
    }
}

private enum AccountEditorMode: Identifiable {
    case create
    case edit(AccountDTO)

    var id: String {
        switch self {
        case .create: return "create"
        case .edit(let a): return "edit-\(a.id)"
        }
    }
}

private struct AccountEditorSheet: View {
    let mode: AccountEditorMode
    var onSaved: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var currency = "RUB"
    @State private var balance = ""
    @State private var bankName = ""
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.md) {
                OBTextField(placeholder: "Название счёта", text: $name)
                OBTextField(placeholder: "Валюта (RUB, USD…)", text: $currency)
                    .textInputAutocapitalization(.characters)
                OBTextField(placeholder: "Баланс", text: $balance)
                    .keyboardType(.decimalPad)
                OBTextField(placeholder: "Банк (опц.)", text: $bankName)

                if let error {
                    Text(error)
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.danger)
                }

                OBButton(title: "Сохранить", isLoading: saving, horizontalPadding: DesignTokens.Spacing.lg) {
                    Task { await save() }
                }
                .padding(.horizontal, DesignTokens.Spacing.md)
                Spacer()
            }
            .padding(DesignTokens.Spacing.lg)
            .obScreenBackground(showPetals: false)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
            .onAppear { prefill() }
        }
        .presentationDetents([.medium, .large])
    }

    private var title: String {
        switch mode {
        case .create: return "Новый счёт"
        case .edit: return "Редактировать"
        }
    }

    private func prefill() {
        if case .edit(let a) = mode {
            name = a.name
            currency = a.currency ?? "RUB"
            balance = String(format: "%.0f", a.balance ?? 0)
            bankName = a.bank_name ?? ""
        }
    }

    private func save() async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            error = "Укажите название"
            return
        }
        guard let bal = Double(balance.replacingOccurrences(of: ",", with: ".")) else {
            error = "Укажите баланс"
            return
        }
        saving = true
        error = nil
        defer { saving = false }

        do {
            switch mode {
            case .create:
                let _: AccountDTO = try await APIClient.shared.request(
                    "POST",
                    path: "accounts",
                    body: CreateAccountBody(
                        name: trimmed,
                        currency: currency.uppercased(),
                        balance: bal,
                        bank_name: bankName.isEmpty ? nil : bankName
                    )
                )
            case .edit(let a):
                let _: AccountDTO = try await APIClient.shared.request(
                    "PATCH",
                    path: "accounts/\(a.id)",
                    body: UpdateAccountBody(
                        name: trimmed,
                        currency: currency.uppercased(),
                        balance: bal,
                        bank_name: bankName.isEmpty ? nil : bankName
                    )
                )
            }
            await onSaved()
            dismiss()
        } catch let err {
            error = err.localizedDescription
        }
    }
}

extension AccountDTO: Hashable {
    static func == (lhs: AccountDTO, rhs: AccountDTO) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
