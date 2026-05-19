import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Сегодня", systemImage: "house.fill") }
            TasksView()
                .tabItem { Label("Задачи", systemImage: "list.bullet") }
            FinanceHubView()
                .tabItem { Label("Финансы", systemImage: "creditcard") }
            GoalsView()
                .tabItem { Label("Цели", systemImage: "target") }
            MoreView()
                .tabItem { Label("Профиль", systemImage: "person.fill") }
        }
        .tint(DesignTokens.Colors.accent)
        .obScreenBackground(showPetals: false)
    }
}
