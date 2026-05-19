import SwiftUI

@main
struct OubaitoriApp: App {
    @StateObject private var auth = AuthRepository.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
        }
    }
}
