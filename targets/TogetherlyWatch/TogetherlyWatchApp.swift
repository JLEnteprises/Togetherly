import SwiftUI

@main
struct TogetherlyWatchApp: App {
    @StateObject private var model = TogetherlyWatchModel()

    var body: some Scene {
        WindowGroup {
            TogetherlyWatchHome()
                .environmentObject(model)
                .task { await model.start() }
        }
    }
}
