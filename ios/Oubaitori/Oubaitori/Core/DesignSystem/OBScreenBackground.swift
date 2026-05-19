import SwiftUI

/// Фон экрана: чёрная база + мягкое свечение сверху (mint) и снизу справа (sakura).
struct OBScreenBackgroundLayer: View {
    var showPetals = true

    var body: some View {
        ZStack {
            DesignTokens.Colors.background
            DesignTokens.Gradients.topGlow
            DesignTokens.Gradients.bottomGlow
            if showPetals {
                SakuraPetalsOverlay()
            }
        }
        .ignoresSafeArea()
    }
}

private struct SakuraPetalsOverlay: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            Group {
                petal(at: CGPoint(x: w * 0.82, y: h * 0.12), size: 14, opacity: 0.35)
                petal(at: CGPoint(x: w * 0.91, y: h * 0.22), size: 10, opacity: 0.25)
                petal(at: CGPoint(x: w * 0.75, y: h * 0.08), size: 8, opacity: 0.2)
                petal(at: CGPoint(x: w * 0.88, y: h * 0.55), size: 12, opacity: 0.18)
                petal(at: CGPoint(x: w * 0.12, y: h * 0.35), size: 9, opacity: 0.12)
            }
        }
        .allowsHitTesting(false)
    }

    private func petal(at point: CGPoint, size: CGFloat, opacity: Double) -> some View {
        Circle()
            .fill(DesignTokens.Colors.sakura.opacity(opacity))
            .frame(width: size, height: size)
            .blur(radius: 1)
            .position(point)
    }
}

struct OBScreenBackground: ViewModifier {
    var showPetals = true

    func body(content: Content) -> some View {
        ZStack {
            OBScreenBackgroundLayer(showPetals: showPetals)
            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

extension View {
    func obScreenBackground(showPetals: Bool = true) -> some View {
        modifier(OBScreenBackground(showPetals: showPetals))
    }
}
