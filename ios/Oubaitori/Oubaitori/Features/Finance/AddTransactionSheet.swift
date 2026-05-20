import SwiftUI

struct CategoryDTO: Codable, Identifiable {
    let id: Int
    let name: String
    let type: String
}

struct CreateFinanceBody: Encodable {
    let type: String
    let amount: Double
    let category: String
    let category_id: Int?
    let comment: String
    let account_id: Int?
    let date: String
}

struct AddTransactionSheet: View {
    @Environment(\.dismiss) private var dismiss
    var initialType: String = "expense"
    var onSaved: () async -> Void

    @State private var txType = "expense"
    @State private var amount = ""
    @State private var category = ""
    @State private var comment = ""
    @State private var accounts: [AccountDTO] = []
    @State private var categories: [CategoryDTO] = []
    @State private var selectedAccountId: Int?
    @State private var selectedCategoryId: Int?
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.md) {
                Picker("Тип", selection: $txType) {
                    Text("Расход").tag("expense")
                    Text("Доход").tag("income")
                }
                .pickerStyle(.segmented)
                .onChange(of: txType) { _, newType in
                    selectedCategoryId = nil
                    category = ""
                    Task { await loadCategories(type: newType) }
                }

                OBTextField(placeholder: "Сумма", text: $amount)
                    .keyboardType(.decimalPad)

                if !filteredCategories.isEmpty {
                    Picker("Категория", selection: $selectedCategoryId) {
                        Text("Выберите").tag(Optional<Int>.none)
                        ForEach(filteredCategories) { c in
                            Text(c.name).tag(Optional(c.id))
                        }
                    }
                    .tint(DesignTokens.Colors.accent)
                } else {
                    OBTextField(placeholder: "Категория", text: $category)
                }

                OBTextField(placeholder: "Комментарий (опц.)", text: $comment)

                if accounts.count > 1 {
                    Picker("Счёт", selection: $selectedAccountId) {
                        ForEach(accounts) { a in
                            Text(a.name).tag(Optional(a.id))
                        }
                    }
                    .tint(DesignTokens.Colors.accent)
                }

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
            .navigationTitle(txType == "income" ? "Доход" : "Расход")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
            }
            .task {
                txType = initialType
                await loadMeta()
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var filteredCategories: [CategoryDTO] {
        categories.filter { $0.type == txType }
    }

    private func loadMeta() async {
        accounts = (try? await APIClient.shared.request("GET", path: "accounts") as [AccountDTO]) ?? []
        await loadCategories(type: txType)
        selectedAccountId = accounts.first(where: { ($0.is_primary ?? 0) == 1 })?.id ?? accounts.first?.id
    }

    private func loadCategories(type: String) async {
        categories = (try? await APIClient.shared.request("GET", path: "categories?type=\(type)") as [CategoryDTO]) ?? []
    }

    private func save() async {
        guard let amt = Double(amount.replacingOccurrences(of: ",", with: ".")), amt > 0 else {
            error = "Укажите сумму"
            return
        }
        let catName: String
        if let cid = selectedCategoryId, let c = categories.first(where: { $0.id == cid }) {
            catName = c.name
        } else {
            catName = category.trimmingCharacters(in: .whitespaces)
        }
        guard !catName.isEmpty else {
            error = "Укажите категорию"
            return
        }

        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        saving = true
        error = nil
        defer { saving = false }

        do {
            let _: FinanceTxDTO = try await APIClient.shared.request(
                "POST",
                path: "finances",
                body: CreateFinanceBody(
                    type: txType,
                    amount: amt,
                    category: catName,
                    category_id: selectedCategoryId,
                    comment: comment.trimmingCharacters(in: .whitespaces),
                    account_id: selectedAccountId,
                    date: fmt.string(from: Date())
                )
            )
            await onSaved()
            dismiss()
        } catch let err {
            error = err.localizedDescription
        }
    }
}

struct FinanceTxDTO: Codable {
    let id: Int?
}
