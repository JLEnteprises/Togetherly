import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private let appGroup: String = {
    let bundle = Bundle.main.bundleIdentifier ?? "com.example.togetherly.watchkitapp.widget"
    let suffix = ".watchkitapp.widget"
    let root = bundle.hasSuffix(suffix) ? String(bundle.dropLast(suffix.count)) : bundle
    return "group.\(root).shared"
}()
private let contextKey = "togetherly.watch.context"
private let stateKey = "togetherly.watch.state"
private let purple = Color(red: 0.61, green: 0.42, blue: 0.96)
private let green = Color(red: 0.55, green: 0.72, blue: 0.45)

private struct WidgetMood: Codable { let id: String?; let mood: String?; let need: String? }
private struct WidgetPerson: Codable { let id: String; let name: String; let color: String }
private struct WidgetPartner: Codable {
    struct Status: Codable { let kind: String; let label: String? }
    let id: String; let name: String; let color: String; let timezone: String; let localTime: String; let status: Status?; let mood: WidgetMood?
}
private struct WidgetRelationship: Codable { let days: Int?; let startDate: String?; let anniversaryDate: String?; let longDistance: Bool }
private struct WidgetVisit: Codable { let id: String; let title: String; let target_at: String; let type: String }
private struct WidgetQuestion: Codable {
    struct Question: Codable { let id: String; let question: String; let category: String }
    let question: Question?; let meAnswered: Bool; let partnerAnswered: Bool; let bothAnswered: Bool
}
private struct WidgetState: Codable {
    let serverTime: String; let me: WidgetPerson; let partner: WidgetPartner; let relationship: WidgetRelationship; let nextVisit: WidgetVisit?; let dailyQuestion: WidgetQuestion
}
private struct WidgetContext: Codable { let apiUrl: String?; let watchToken: String?; let state: WidgetState? }

private enum TogetherlyWidgetStore {
    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
    static func context() -> WidgetContext? {
        if let raw = defaults?.string(forKey: contextKey), let data = raw.data(using: .utf8), let value = try? JSONDecoder().decode(WidgetContext.self, from: data) { return value }
        return nil
    }
    static func state() -> WidgetState? {
        if let value = context()?.state { return value }
        if let raw = defaults?.string(forKey: stateKey), let data = raw.data(using: .utf8) { return try? JSONDecoder().decode(WidgetState.self, from: data) }
        return nil
    }
    static func sendPing(_ kind: String) async throws {
        guard let context = context(), let rawURL = context.apiUrl, let token = context.watchToken,
              let base = URL(string: rawURL), let url = URL(string: "/watch/ping", relativeTo: base) else { throw URLError(.userAuthenticationRequired) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("Watch \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["kind": kind, "source": "widget"])
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw URLError(.badServerResponse) }
    }
}

struct WatchLoveIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Love"
    static var description = IntentDescription("Send your partner a little Togetherly love tap.")
    static var openAppWhenRun = false
    func perform() async throws -> some IntentResult {
        try await TogetherlyWidgetStore.sendPing("love")
        return .result()
    }
}

struct WatchThinkingIntent: AppIntent {
    static var title: LocalizedStringResource = "Thinking of You"
    static var description = IntentDescription("Tell your partner they crossed your mind.")
    static var openAppWhenRun = false
    func perform() async throws -> some IntentResult {
        try await TogetherlyWidgetStore.sendPing("thinking_of_you")
        return .result()
    }
}

private struct TogetherlyEntry: TimelineEntry { let date: Date; let state: WidgetState? }
private struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> TogetherlyEntry { TogetherlyEntry(date: .now, state: nil) }
    func getSnapshot(in context: Context, completion: @escaping (TogetherlyEntry) -> Void) { completion(TogetherlyEntry(date: .now, state: TogetherlyWidgetStore.state())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TogetherlyEntry>) -> Void) {
        completion(Timeline(entries: [TogetherlyEntry(date: .now, state: TogetherlyWidgetStore.state())], policy: .after(.now.addingTimeInterval(15 * 60))))
    }
}

private struct PartnerStatusView: View {
    let entry: TogetherlyEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        if let state = entry.state {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Text(moodEmoji(state.partner.mood?.mood)).font(.title3)
                        Text(state.partner.localTime).font(.system(size: 8, weight: .semibold, design: .rounded)).monospacedDigit()
                    }
                }
            case .accessoryInline:
                Text("\(state.partner.name) \(moodEmoji(state.partner.mood?.mood)) · \(state.partner.localTime)")
            default:
                HStack(spacing: 7) {
                    Circle().fill(state.partner.color == "green" ? green : purple).frame(width: 7, height: 7)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(state.partner.name).font(.caption).fontWeight(.semibold).lineLimit(1)
                        Text(statusText(state)).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 2)
                    Text(state.partner.localTime).font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                }
            }
        } else {
            Label("Open Togetherly", systemImage: "heart")
                .font(.caption2)
        }
    }

    private func statusText(_ state: WidgetState) -> String {
        if let label = state.partner.status?.label { return label }
        if let mood = state.partner.mood?.mood { return mood.capitalized }
        return "Togetherly"
    }
    private func moodEmoji(_ mood: String?) -> String {
        switch mood { case "amazing": return "🥰"; case "good": return "😊"; case "okay": return "🙂"; case "low": return "😔"; case "frustrated": return "😤"; case "overwhelmed": return "😫"; case "tired": return "😴"; case "stressed": return "😣"; default: return "♡" }
    }
}

struct TogetherlyPartnerComplication: Widget {
    let kind = "TogetherlyPartnerComplication"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            PartnerStatusView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Partner")
        .description("Your partner's time, mood and status at a glance.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct LoveTapView: View {
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Button(intent: WatchLoveIntent()) {
                Image(systemName: "heart.fill")
                    .font(.title2)
                    .foregroundStyle(purple)
            }
            .buttonStyle(.plain)
        }
    }
}

struct TogetherlyLoveComplication: Widget {
    let kind = "TogetherlyLoveComplication"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { _ in
            LoveTapView().containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Love Tap")
        .description("Send your partner love straight from your watch face or Smart Stack.")
        .supportedFamilies([.accessoryCircular])
    }
}

private struct VisitView: View {
    let entry: TogetherlyEntry
    var body: some View {
        if let visit = entry.state?.nextVisit {
            HStack {
                Image(systemName: "heart.circle.fill")
                VStack(alignment: .leading, spacing: 1) {
                    Text("Next visit").font(.caption2).foregroundStyle(.secondary)
                    Text(daysUntil(visit.target_at)).font(.caption).fontWeight(.bold)
                }
                Spacer()
            }
        } else if let days = entry.state?.relationship.days {
            Label("\(days) days together", systemImage: "infinity")
                .font(.caption)
        } else {
            Label("Togetherly", systemImage: "heart")
        }
    }
    private func daysUntil(_ raw: String) -> String {
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: raw) else { return "Soon" }
        let days = max(0, Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0)
        return days == 0 ? "Today ♡" : "\(days)d to go"
    }
}

struct TogetherlyVisitComplication: Widget {
    let kind = "TogetherlyVisitComplication"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            VisitView(entry: entry).containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Next Visit")
        .description("Count down until you're together again.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline])
    }
}

@main
struct TogetherlyWatchWidgetBundle: WidgetBundle {
    var body: some Widget {
        TogetherlyPartnerComplication()
        TogetherlyLoveComplication()
        TogetherlyVisitComplication()
    }
}
