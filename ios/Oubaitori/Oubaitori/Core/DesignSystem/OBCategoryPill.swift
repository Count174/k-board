import SwiftUI

struct OBCategoryPill: View {
    let title: String
    var color: Color = DesignTokens.Colors.categoryPersonal
    var filled = false

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(title)
                .font(DesignTokens.Typography.caption)
        }
        .foregroundStyle(filled ? Color.white : color)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            filled ? color.opacity(0.85) : color.opacity(0.12)
        )
        .overlay(
            Capsule().stroke(color.opacity(filled ? 0 : 0.5), lineWidth: 1)
        )
        .clipShape(Capsule())
    }
}

enum OBCategoryColor {
    static func forName(_ name: String) -> Color {
        let n = name.lowercased()
        if n.contains("работ") || n.contains("work") { return DesignTokens.Colors.categoryWork }
        if n.contains("здоров") || n.contains("health") { return DesignTokens.Colors.categoryHealth }
        if n.contains("финанс") || n.contains("finance") { return DesignTokens.Colors.categoryFinance }
        return DesignTokens.Colors.categoryPersonal
    }
}
