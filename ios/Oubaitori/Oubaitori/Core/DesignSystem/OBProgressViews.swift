import SwiftUI

struct OBLinearProgress: View {
    let value: Double
    var tint: Color = DesignTokens.Colors.accent

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(DesignTokens.Colors.cardBorder.opacity(0.5))
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [tint.opacity(0.9), tint],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: max(0, geo.size.width * min(1, max(0, value))))
                    .shadow(color: tint.opacity(0.4), radius: 6)
            }
        }
        .frame(height: 8)
    }
}

struct OBCircularProgress: View {
    let progress: Double
    var lineWidth: CGFloat = 6
    var tint: Color = DesignTokens.Colors.accent
    var label: String?

    var body: some View {
        ZStack {
            Circle()
                .stroke(DesignTokens.Colors.cardBorder.opacity(0.4), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(1, max(0, progress)))
                .stroke(
                    tint,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .shadow(color: tint.opacity(0.35), radius: 4)
            if let label {
                Text(label)
                    .font(DesignTokens.Typography.captionBold)
                    .foregroundStyle(DesignTokens.Colors.textPrimary)
            }
        }
    }
}
