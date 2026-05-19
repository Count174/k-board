import SwiftUI

struct OBButton: View {
    let title: String
    var style: Style = .primary
    var isLoading = false
    let action: () -> Void

    enum Style { case primary, secondary, ghost }

    var body: some View {
        Button(action: action) {
            Group {
                switch style {
                case .primary:
                    primaryLabel
                case .secondary:
                    secondaryLabel
                case .ghost:
                    ghostLabel
                }
            }
            .frame(maxWidth: .infinity)
        }
        .disabled(isLoading)
    }

    private var primaryLabel: some View {
        HStack(spacing: 8) {
            if isLoading {
                ProgressView().tint(Color(hex: 0x0A1F18))
            }
            Text(title)
                .font(DesignTokens.Typography.headline)
                .foregroundStyle(Color(hex: 0x0A1F18))
        }
        .padding(.vertical, 16)
        .background(DesignTokens.Gradients.primaryButton)
        .clipShape(Capsule())
        .shadow(color: DesignTokens.Colors.accentGlow, radius: 16, y: 6)
    }

    private var secondaryLabel: some View {
        HStack {
            if isLoading { ProgressView().tint(DesignTokens.Colors.textPrimary) }
            Text(title).font(DesignTokens.Typography.headline)
        }
        .foregroundStyle(DesignTokens.Colors.textPrimary)
        .padding(.vertical, 14)
        .background(DesignTokens.Colors.card)
        .overlay(Capsule().stroke(DesignTokens.Colors.cardBorder, lineWidth: 1))
        .clipShape(Capsule())
    }

    private var ghostLabel: some View {
        Text(title)
            .font(DesignTokens.Typography.callout)
            .foregroundStyle(DesignTokens.Colors.sakura)
            .padding(.vertical, 8)
    }
}
