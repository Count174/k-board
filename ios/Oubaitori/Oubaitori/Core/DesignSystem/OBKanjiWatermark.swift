import SwiftUI

/// Вертикальные иероглифы в углу экрана (как на макетах).
struct OBKanjiWatermark: View {
    var text: String = DesignTokens.Brand.kanjiVertical
    var color: Color = DesignTokens.Colors.sakura.opacity(0.55)

    var body: some View {
        Text(verticalKanji)
            .font(.system(size: 22, weight: .medium))
            .multilineTextAlignment(.center)
            .foregroundStyle(color)
            .accessibilityHidden(true)
    }

    private var verticalKanji: String {
        text.map(String.init).joined(separator: "\n")
    }
}

struct OBKanjiBadge: View {
    let character: String
    var color: Color = DesignTokens.Colors.sakura

    var body: some View {
        Text(character)
            .font(.system(size: 20, weight: .medium))
            .foregroundStyle(color)
    }
}
