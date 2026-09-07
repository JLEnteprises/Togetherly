import Foundation
import SwiftUI
import WatchConnectivity
import WidgetKit
import WatchKit

private let togetherlyAppGroup: String = {
    let bundle = Bundle.main.bundleIdentifier ?? "com.example.togetherly.watchkitapp"
    let root = bundle.hasSuffix(".watchkitapp") ? String(bundle.dropLast(".watchkitapp".count)) : bundle
    return "group.\(root).shared"
}()
private let contextKey = "togetherly.watch.context"
private let stateKey = "togetherly.watch.state"

struct WatchMood: Codable, Equatable {
    let id: String?
    let mood: String?
    let need: String?
    let created_at: String?
}

struct WatchPerson: Codable, Equatable {
    let id: String
    let name: String
    let color: String
}

struct WatchPartner: Codable, Equatable {
    struct Status: Codable, Equatable { let kind: String; let label: String? }
    let id: String
    let name: String
    let color: String
    let timezone: String
    let localTime: String
    let status: Status?
    let mood: WatchMood?
}

struct WatchRelationship: Codable, Equatable {
    let days: Int?
    let startDate: String?
    let anniversaryDate: String?
    let longDistance: Bool
}

struct WatchVisit: Codable, Equatable {
    let id: String
    let title: String
    let target_at: String
    let type: String
}

struct WatchQuestion: Codable, Equatable {
    struct Question: Codable, Equatable { let id: String; let question: String; let category: String }
    let question: Question?
    let meAnswered: Bool
    let partnerAnswered: Bool
    let bothAnswered: Bool
}

struct WatchState: Codable, Equatable {
    let serverTime: String
    let me: WatchPerson
    let partner: WatchPartner
    let relationship: WatchRelationship
    let nextVisit: WatchVisit?
    let dailyQuestion: WatchQuestion
}

private struct PhoneContext: Codable {
    let version: Int?
    let apiUrl: String?
    let watchToken: String?
    let watchTokenExpiresAt: String?
    let appGroup: String?
    let state: WatchState?
    let syncedAt: String?
}

@MainActor
final class TogetherlyWatchModel: NSObject, ObservableObject, WCSessionDelegate {
    @Published var state: WatchState?
    @Published var isLoading = false
    @Published var isSending = false
    @Published var lastMessage: String?
    @Published var connectionLabel = "Connecting…"

    private var apiURL: String?
    private var watchToken: String?
    private var session: WCSession?
    private let defaults = UserDefaults(suiteName: togetherlyAppGroup)

    override init() {
        super.init()
        restoreSharedContext()
        activateConnectivity()
    }

    func start() async {
        await refresh()
    }

    private func restoreSharedContext() {
        if let raw = defaults?.string(forKey: contextKey),
           let data = raw.data(using: .utf8),
           let context = try? JSONDecoder().decode(PhoneContext.self, from: data) {
            apply(context)
            return
        }
        if let raw = defaults?.string(forKey: stateKey),
           let data = raw.data(using: .utf8),
           let restored = try? JSONDecoder().decode(WatchState.self, from: data) {
            state = restored
        }
    }

    private func activateConnectivity() {
        guard WCSession.isSupported() else {
            connectionLabel = "Open Togetherly on iPhone"
            return
        }
        let wc = WCSession.default
        wc.delegate = self
        wc.activate()
        session = wc
    }

    private func apply(_ context: PhoneContext) {
        apiURL = context.apiUrl?.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        watchToken = context.watchToken
        if let next = context.state {
            state = next
            persistState(next)
        }
        connectionLabel = watchToken == nil ? "Open Togetherly on iPhone" : "Connected"
    }

    private func persistState(_ value: WatchState) {
        guard let data = try? JSONEncoder().encode(value), let raw = String(data: data, encoding: .utf8) else { return }
        defaults?.set(raw, forKey: stateKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func consume(dictionary: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(dictionary),
              let data = try? JSONSerialization.data(withJSONObject: dictionary),
              let context = try? JSONDecoder().decode(PhoneContext.self, from: data) else { return }
        if let raw = String(data: data, encoding: .utf8) { defaults?.set(raw, forKey: contextKey) }
        apply(context)
    }

    func refresh() async {
        guard !isLoading else { return }
        guard let apiURL, let watchToken else {
            connectionLabel = "Open Togetherly on iPhone"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let response: WatchStateResponse = try await api(path: "/watch/state", method: "GET", body: Optional<String>.none)
            state = response.state
            persistState(response.state)
            connectionLabel = "Connected"
        } catch {
            connectionLabel = "Using last sync"
        }
    }

    func sendPing(_ kind: String) async {
        guard !isSending else { return }
        isSending = true
        defer { isSending = false }
        WKInterfaceDevice.current().play(kind == "love" ? .success : .click)
        let action: [String: Any] = ["type": "ping", "kind": kind]
        do {
            let body = try JSONSerialization.data(withJSONObject: ["kind": kind, "source": "watch"])
            let response: WatchStateResponse = try await api(path: "/watch/ping", method: "POST", rawBody: body)
            state = response.state
            persistState(response.state)
            lastMessage = kind == "love" ? "Love sent ♡" : "Thinking of you sent ✦"
        } catch {
            queueOnPhone(action)
            lastMessage = kind == "love" ? "Love queued ♡" : "Ping queued ✦"
        }
    }

    func checkIn(mood: String, need: String) async {
        guard !isSending else { return }
        isSending = true
        defer { isSending = false }
        let action: [String: Any] = ["type": "check_in", "mood": mood, "need": need]
        do {
            let body = try JSONSerialization.data(withJSONObject: ["mood": mood, "need": need])
            let response: WatchStateResponse = try await api(path: "/watch/check-in", method: "POST", rawBody: body)
            state = response.state
            persistState(response.state)
            WKInterfaceDevice.current().play(.success)
            lastMessage = "Check-in shared"
        } catch {
            queueOnPhone(action)
            lastMessage = "Check-in queued"
        }
    }

    func acknowledgeMood() async {
        guard let moodId = state?.partner.mood?.id, !moodId.isEmpty, !isSending else { return }
        isSending = true
        defer { isSending = false }
        let action: [String: Any] = ["type": "acknowledge", "moodId": moodId]
        do {
            let body = try JSONSerialization.data(withJSONObject: ["moodId": moodId])
            let _: OKResponse = try await api(path: "/watch/acknowledge", method: "POST", rawBody: body)
            WKInterfaceDevice.current().play(.success)
            lastMessage = "Support sent ♡"
        } catch {
            queueOnPhone(action)
            lastMessage = "Support queued ♡"
        }
    }

    private func queueOnPhone(_ action: [String: Any]) {
        guard let session else { return }
        if session.isReachable {
            session.sendMessage(action, replyHandler: nil, errorHandler: { [weak self] _ in
                self?.session?.transferUserInfo(["action": action])
            })
        } else {
            session.transferUserInfo(["action": action])
        }
    }

    private struct WatchStateResponse: Decodable { let state: WatchState }
    private struct OKResponse: Decodable { let ok: Bool }

    private func api<Response: Decodable, Body: Encodable>(path: String, method: String, body: Body?) async throws -> Response {
        let data = body.flatMap { try? JSONEncoder().encode($0) }
        return try await api(path: path, method: method, rawBody: data)
    }

    private func api<Response: Decodable>(path: String, method: String, rawBody: Data?) async throws -> Response {
        guard let apiURL, let base = URL(string: apiURL), let watchToken else { throw URLError(.userAuthenticationRequired) }
        guard let url = URL(string: path, relativeTo: base) else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 12
        request.setValue("Watch \(watchToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let rawBody {
            request.httpBody = rawBody
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(Response.self, from: data)
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor [weak self] in
            self?.connectionLabel = error == nil ? (self?.watchToken == nil ? "Open Togetherly on iPhone" : "Connected") : "Using last sync"
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        Task { @MainActor [weak self] in
            self?.consume(dictionary: applicationContext)
            await self?.refresh()
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        Task { @MainActor [weak self] in
            if let payload = userInfo["payload"] as? [String: Any] { self?.consume(dictionary: payload) }
            else { self?.consume(dictionary: userInfo) }
            await self?.refresh()
        }
    }
}
