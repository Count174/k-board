import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthRepository
    @State private var bootstrapped = false
    @State private var showAuth = false

    var body: some View {
        Group {
            if !bootstrapped {
                ProgressView()
                    .tint(DesignTokens.Colors.accent)
            } else if auth.isAuthenticated {
                MainTabView()
            } else if showAuth {
                LoginView(onBack: { showAuth = false })
            } else {
                WelcomeView(
                    onStart: { showAuth = true },
                    onLogin: { showAuth = true }
                )
            }
        }
        .obScreenBackground()
        .preferredColorScheme(.dark)
        .task {
            OBTabBarAppearance.apply()
            if auth.isAuthenticated {
                try? await auth.loadMe()
                await PushNotificationService.shared.registerIfNeeded()
            }
            bootstrapped = true
        }
    }
}
