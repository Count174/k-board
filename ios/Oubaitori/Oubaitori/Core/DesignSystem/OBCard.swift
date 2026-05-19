import SwiftUI

struct OBCard<Content: View>: View {
    var borderColor: Color = DesignTokens.Colors.cardBorder
    var glow: Bool = false
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DesignTokens.Colors.card)
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                    .stroke(borderColor, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
            .shadow(
                color: glow ? DesignTokens.Colors.accentGlow : .clear,
                radius: glow ? 12 : 0,
                y: glow ? 4 : 0
            )
    }
}
