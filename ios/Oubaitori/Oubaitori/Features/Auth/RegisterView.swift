import SwiftUI

struct RegisterView: View {
    @EnvironmentObject private var auth: AuthRepository
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                Text("Регистрация")
                    .font(DesignTokens.Typography.largeTitle)
                    .foregroundStyle(DesignTokens.Colors.textPrimary)

                OBTextField(placeholder: "Имя", text: $name)
                OBTextField(placeholder: "Email", text: $email)
                    .keyboardType(.emailAddress)
                OBTextField(placeholder: "Пароль (от 6 символов)", text: $password, isSecure: true)

                if let error {
                    Text(error)
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.danger)
                }

                OBButton(title: "Зарегистрироваться", isLoading: loading) {
                    Task { await submit() }
                }
            }
            .padding(DesignTokens.Spacing.lg)
        }
        .obScreenBackground(showPetals: false)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func submit() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            try await auth.register(name: name, email: email, password: password)
            try await auth.loadMe()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
