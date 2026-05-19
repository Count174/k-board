import SwiftUI

/// Дизайн-токены Oubaitori / o-board (по iOS-макетам).
enum DesignTokens {
    // MARK: - Colors

    enum Colors {
        /// Основной фон (#050505)
        static let background = Color(hex: 0x050505)
        /// Приподнятая поверхность (#0D1111)
        static let backgroundElevated = Color(hex: 0x0D1111)
        /// Карточки (#161B1B)
        static let card = Color(hex: 0x161B1B)
        static let cardBorder = Color.white.opacity(0.08)
        static let inputBackground = Color(hex: 0x2C2C2E)

        static let textPrimary = Color.white
        static let textSecondary = Color(hex: 0x9CA3AF)
        static let textTertiary = Color(hex: 0x52525B)
        /// Алиас для совместимости
        static let textMuted = textSecondary

        /// Mint / teal — основной акцент
        static let accent = Color(hex: 0x76D6B4)
        static let accentBright = Color(hex: 0x4ADE80)
        static let accentDim = Color(hex: 0x76D6B4).opacity(0.14)
        static let accentGlow = Color(hex: 0x76D6B4).opacity(0.45)

        /// Sakura / pink — бренд, kanji, декор
        static let sakura = Color(hex: 0xF9A8D4)
        static let sakuraSoft = Color(hex: 0xFFB7C5)

        /// Coral / salmon — расходы, кредиты, health
        static let coral = Color(hex: 0xFF8A71)
        static let coralBright = Color(hex: 0xFB7185)

        static let warning = Color(hex: 0xFBBF24)
        static let danger = Color(hex: 0xFF6B6B)

        /// Категории задач / бюджета
        static let categoryPersonal = Color(hex: 0x76D6B4)
        static let categoryWork = Color(hex: 0xFFCC00)
        static let categoryHealth = Color(hex: 0xFF8A71)
        static let categoryFinance = Color(hex: 0xD087B0)
        static let categoryTransport = Color(hex: 0x81D4FA)
        static let categoryEntertainment = Color(hex: 0xF9A8D4)
        static let categoryOther = Color(hex: 0x9B86D1)

        /// Цели: финансы / обучение / здоровье
        static let goalFinance = Color(hex: 0xA8E6CF)
        static let goalEducation = Color(hex: 0xFF8B94)
        static let goalHealth = Color(hex: 0xFFD3B6)
    }

    enum Gradients {
        static let primaryButton = LinearGradient(
            colors: [Color(hex: 0xA3E9D1), Color(hex: 0x50B498)],
            startPoint: .leading,
            endPoint: .trailing
        )
        static let mintChartFill = LinearGradient(
            colors: [Colors.accent.opacity(0.35), Colors.accent.opacity(0)],
            startPoint: .top,
            endPoint: .bottom
        )
        static let topGlow = RadialGradient(
            colors: [Colors.accent.opacity(0.12), Color.clear],
            center: .top,
            startRadius: 0,
            endRadius: 320
        )
        static let bottomGlow = RadialGradient(
            colors: [Colors.sakura.opacity(0.08), Color.clear],
            center: .bottomTrailing,
            startRadius: 0,
            endRadius: 280
        )
        static let coralBar = LinearGradient(
            colors: [Color(hex: 0xFF9E80), Color(hex: 0xF9A8D4)],
            startPoint: .bottom,
            endPoint: .top
        )
    }

    // MARK: - Typography

    enum Typography {
        static let largeTitle = Font.system(size: 34, weight: .bold)
        static let title = Font.system(size: 28, weight: .bold)
        static let title2 = Font.system(size: 22, weight: .semibold)
        static let headline = Font.system(size: 17, weight: .semibold)
        static let body = Font.system(size: 16, weight: .regular)
        static let callout = Font.system(size: 15, weight: .regular)
        static let caption = Font.system(size: 13, weight: .regular)
        static let captionBold = Font.system(size: 13, weight: .semibold)
        static let metricLarge = Font.system(size: 32, weight: .bold)
        static let metricHero = Font.system(size: 40, weight: .bold)
    }

    // MARK: - Layout

    enum Radius {
        static let card: CGFloat = 24
        static let input: CGFloat = 12
        static let button: CGFloat = 999
        static let pill: CGFloat = 999
        static let progressBar: CGFloat = 6
    }

    enum Spacing {
        static let xs: CGFloat = 6
        static let sm: CGFloat = 10
        static let md: CGFloat = 16
        static let lg: CGFloat = 20
        static let xl: CGFloat = 28
    }

    enum Brand {
        static let appName = "o-board"
        static let tagline = "Каждый цветёт в своё время"
        static let subtitle = "Спокойная продуктивность без сравнений"
        static let kanjiVertical = "桜梅桃李"
    }
}

// MARK: - Color hex

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
