import SwiftUI

/// Онбординг / splash по макету: o-board, иероглифы, «Начать».
struct WelcomeView: View {
    var onStart: () -> Void
    var onLogin: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 0) {
                Spacer(minLength: 48)
                VStack(spacing: DesignTokens.Spacing.md) {
                    Text(DesignTokens.Brand.appName)
                        .font(DesignTokens.Typography.metricHero)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)

                    Text(DesignTokens.Brand.tagline)
                        .font(DesignTokens.Typography.title2)
                        .foregroundStyle(DesignTokens.Colors.accent)
                        .multilineTextAlignment(.center)

                    Text(DesignTokens.Brand.subtitle)
                        .font(DesignTokens.Typography.callout)
                        .foregroundStyle(DesignTokens.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)

                Spacer()

                VStack(spacing: DesignTokens.Spacing.md) {
                    OBButton(title: "Начать", style: .primary, action: onStart)
                    Button(action: onLogin) {
                        Text("У меня уже есть аккаунт")
                            .font(DesignTokens.Typography.callout)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, 48)
            }

            OBKanjiWatermark()
                .padding(.top, 56)
                .padding(.trailing, DesignTokens.Spacing.lg)
        }
        .obScreenBackground()
    }
}
