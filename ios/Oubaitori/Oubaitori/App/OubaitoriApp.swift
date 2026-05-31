import SwiftUI

@main
struct OubaitoriApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthRepository.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(PushDeepLinkRouter.shared)
        }
    }
}
