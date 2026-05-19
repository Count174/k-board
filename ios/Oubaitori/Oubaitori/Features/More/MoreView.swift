import SwiftUI

struct MoreView: View {
    @EnvironmentObject private var auth: AuthRepository

    var body: some View {
        NavigationStack {
            ZStack(alignment: .topLeading) {
                List {
                    if let u = auth.currentUser {
                        Section {
                            HStack(spacing: 14) {
                                Circle()
                                    .fill(DesignTokens.Colors.accentDim)
                                    .frame(width: 56, height: 56)
                                    .overlay(
                                        Text(String(u.name.prefix(1)))
                                            .font(DesignTokens.Typography.title2)
                                            .foregroundStyle(DesignTokens.Colors.accent)
                                    )
                                    .overlay(Circle().stroke(DesignTokens.Colors.accent.opacity(0.5), lineWidth: 2))
                                VStack(alignment: .leading) {
                                    Text(u.name)
                                        .font(DesignTokens.Typography.headline)
                                    Text(u.email)
                                        .font(DesignTokens.Typography.caption)
                                        .foregroundStyle(DesignTokens.Colors.textSecondary)
                                }
                            }
                            .listRowBackground(DesignTokens.Colors.card)
                        }
                    }

                    Section("Сад") {
                        navLink("Тренировки", icon: "figure.strengthtraining.traditional") { WorkoutsView() }
                        navLink("Лекарства", icon: "pills.fill") { MedicationsView() }
                        navLink("История жизни", icon: "clock.arrow.circlepath") { HistoryView() }
                    }

                    Section("Аккаунт") {
                        navLink("Настройки", icon: "gearshape") { SettingsView() }
                        navLink("WHOOP", icon: "waveform.path.ecg") { WhoopPlaceholderView() }
                    }

                    Section {
                        Button(role: .destructive) {
                            Task { await auth.logout() }
                        } label: {
                            Label("Выйти", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                }
                .scrollContentBackground(.hidden)

                OBKanjiWatermark(text: "我")
                    .padding(.top, 56)
                    .padding(.leading, DesignTokens.Spacing.lg)
            }
            .navigationTitle("Профиль")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private func navLink<D: View>(_ title: String, icon: String, @ViewBuilder destination: () -> D) -> some View {
        NavigationLink(destination: destination) {
            Label(title, systemImage: icon)
                .foregroundStyle(DesignTokens.Colors.textPrimary)
        }
        .listRowBackground(DesignTokens.Colors.card)
    }
}

struct WhoopPlaceholderView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("Подключение WHOOP")
                .font(DesignTokens.Typography.title2)
                .foregroundStyle(DesignTokens.Colors.textPrimary)
            Text("OAuth через ASWebAuthenticationSession")
                .multilineTextAlignment(.center)
                .font(DesignTokens.Typography.callout)
                .foregroundStyle(DesignTokens.Colors.textSecondary)
        }
        .padding()
        .obScreenBackground(showPetals: false)
        .navigationTitle("WHOOP")
    }
}
