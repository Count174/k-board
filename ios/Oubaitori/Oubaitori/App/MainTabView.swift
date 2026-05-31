import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var deepLink: PushDeepLinkRouter

    var body: some View {
        TabView(selection: $deepLink.selectedTab) {
            DashboardView()
                .tabItem { Label("Сегодня", systemImage: "house.fill") }
                .tag(0)
            TasksView()
                .tabItem { Label("Задачи", systemImage: "list.bullet") }
                .tag(1)
            FinanceHubView()
                .tabItem { Label("Финансы", systemImage: "creditcard") }
                .tag(2)
            GoalsView()
                .tabItem { Label("Цели", systemImage: "target") }
                .tag(3)
            MoreView()
                .tabItem { Label("Профиль", systemImage: "person.fill") }
                .tag(4)
        }
        .tint(DesignTokens.Colors.accent)
        .obScreenBackground(showPetals: false)
        .sheet(isPresented: $deepLink.showMedications, onDismiss: { deepLink.clearMedications() }) {
            NavigationStack {
                MedicationsView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Закрыть") { deepLink.clearMedications() }
                        }
                    }
            }
        }
        .sheet(isPresented: $deepLink.showWorkouts, onDismiss: { deepLink.clearWorkouts() }) {
            NavigationStack {
                WorkoutsView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Закрыть") { deepLink.clearWorkouts() }
                        }
                    }
            }
        }
    }
}
