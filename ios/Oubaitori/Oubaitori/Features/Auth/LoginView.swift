import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var auth: AuthRepository
    var onBack: (() -> Void)?
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topTrailing) {
                ScrollView {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                        Text(DesignTokens.Brand.appName)
                            .font(DesignTokens.Typography.largeTitle)
                            .foregroundStyle(DesignTokens.Colors.textPrimary)
                        Text("Войдите в личный дашборд")
                            .font(DesignTokens.Typography.callout)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)

                        VStack(spacing: DesignTokens.Spacing.sm) {
                            OBTextField(placeholder: "Email", text: $email)
                                .keyboardType(.emailAddress)
                                .textContentType(.emailAddress)
                            OBTextField(placeholder: "Пароль", text: $password, isSecure: true)
                                .textContentType(.password)
                        }

                        if let error {
                            Text(error)
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.danger)
                        }

                        OBButton(title: "Войти", isLoading: loading) {
                            Task { await submit() }
                        }

                        Button("Создать аккаунт") { showRegister = true }
                            .font(DesignTokens.Typography.callout)
                            .foregroundStyle(DesignTokens.Colors.accent)
                    }
                    .padding(DesignTokens.Spacing.lg)
                }

                OBKanjiWatermark()
                    .padding(.top, 8)
                    .padding(.trailing, DesignTokens.Spacing.lg)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if onBack != nil {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            onBack?()
                        } label: {
                            Image(systemName: "chevron.left")
                                .foregroundStyle(DesignTokens.Colors.textSecondary)
                        }
                    }
                }
            }
            .navigationDestination(isPresented: $showRegister) {
                RegisterView()
            }
        }
    }

    private func submit() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            try await auth.login(email: email, password: password)
            try await auth.loadMe()
        } catch let err {
            self.error = err.localizedDescription
        }
    }
}
