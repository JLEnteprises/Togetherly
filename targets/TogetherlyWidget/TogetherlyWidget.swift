import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private let appGroup: String = {
    let bundle = Bundle.main.bundleIdentifier ?? "com.example.togetherly.widget"
    let suffix = ".widget"
    let root = bundle.hasSuffix(suffix) ? String(bundle.dropLast(suffix.count)) : bundle
    return "group.\(root).shared"
}()
private let contextKey = "togetherly.watch.context"
private let stateKey = "togetherly.watch.state"
private let neutralAccent = Color(red: 0.87, green: 0.84, blue: 0.90)

private func identityColor(_ raw: String) -> Color {
    let legacy: String
    switch raw.lowercased() {
    case "purple": legacy = "#BE9AFF"
    case "green": legacy = "#B7CB7C"
    default: legacy = raw
    }
    let value = legacy.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    guard value.count == 6, let number = Int(value, radix: 16) else { return neutralAccent }
    return Color(
        red: Double((number >> 16) & 0xFF) / 255.0,
        green: Double((number >> 8) & 0xFF) / 255.0,
        blue: Double(number & 0xFF) / 255.0
    )
}

private struct PhoneWidgetMood: Codable { let id: String?; let mood: String?; let need: String? }
private struct PhoneWidgetPerson: Codable { let id: String; let name: String; let color: String }
private struct PhoneWidgetPartner: Codable {
    struct Status: Codable { let kind: String; let label: String? }
    let id: String; let name: String; let color: String; let timezone: String; let localTime: String; let status: Status?; let mood: PhoneWidgetMood?
}
private struct PhoneWidgetRelationship: Codable { let days: Int?; let startDate: String?; let anniversaryDate: String?; let longDistance: Bool }
private struct PhoneWidgetVisit: Codable { let id: String; let title: String; let target_at: String; let type: String }
private struct PhoneWidgetQuestion: Codable {
    struct Question: Codable { let id: String; let question: String; let category: String }
    let question: Question?; let meAnswered: Bool; let partnerAnswered: Bool; let bothAnswered: Bool
}
private struct PhoneWidgetState: Codable {
    let serverTime: String; let me: PhoneWidgetPerson; let partner: PhoneWidgetPartner; let relationship: PhoneWidgetRelationship; let nextVisit: PhoneWidgetVisit?; let dailyQuestion: PhoneWidgetQuestion
}
private struct PhoneWidgetContext: Codable { let apiUrl: String?; let watchToken: String?; let state: PhoneWidgetState? }

private enum PhoneWidgetStore {
    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
    static func context() -> PhoneWidgetContext? {
        guard let raw = defaults?.string(forKey: contextKey), let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(PhoneWidgetContext.self, from: data)
    }
    static func state() -> PhoneWidgetState? {
        if let state = context()?.state { return state }
        guard let raw = defaults?.string(forKey: stateKey), let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(PhoneWidgetState.self, from: data)
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

struct PhoneLoveIntent: AppIntent {
    static var title: LocalizedStringResource = "Send Love"
    static var description = IntentDescription("Send your partner a little Togetherly love tap.")
    static var openAppWhenRun = false
    func perform() async throws -> some IntentResult {
        try await PhoneWidgetStore.sendPing("love")
        return .result()
    }
}

private struct PhoneEntry: TimelineEntry { let date: Date; let state: PhoneWidgetState? }
private struct PhoneProvider: TimelineProvider {
    func placeholder(in context: Context) -> PhoneEntry { PhoneEntry(date: .now, state: nil) }
    func getSnapshot(in context: Context, completion: @escaping (PhoneEntry) -> Void) { completion(PhoneEntry(date: .now, state: PhoneWidgetStore.state())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PhoneEntry>) -> Void) {
        completion(Timeline(entries: [PhoneEntry(date: .now, state: PhoneWidgetStore.state())], policy: .after(.now.addingTimeInterval(15 * 60))))
    }
}

private struct PhonePartnerView: View {
    let entry: PhoneEntry
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
            case .accessoryRectangular:
                HStack(spacing: 7) {
                    Circle().fill(identityColor(state.partner.color)).frame(width: 7, height: 7)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(state.partner.name).font(.caption).fontWeight(.semibold).lineLimit(1)
                        Text(statusText(state)).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    Text(state.partner.localTime).font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                }
            default:
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Circle().fill(identityColor(state.partner.color)).frame(width: 10, height: 10)
                        Text(state.partner.name).font(.headline).lineLimit(1)
                        Spacer()
                        Text(state.partner.localTime).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                    Text("\(moodEmoji(state.partner.mood?.mood)) \(statusText(state))")
                        .font(.subheadline).lineLimit(1)
                    if let visit = state.nextVisit {
                        Label(daysUntil(visit.target_at), systemImage: "heart.circle.fill")
                            .font(.caption).foregroundStyle(neutralAccent)
                    }
                    Spacer(minLength: 0)
                    Button(intent: PhoneLoveIntent()) {
                        Label("Send love", systemImage: "heart.fill")
                            .font(.caption).fontWeight(.semibold)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(neutralAccent)
                }
                .padding(2)
            }
        } else {
            VStack(spacing: 5) {
                Image(systemName: "heart.circle").font(.title2)
                Text("Open Togetherly").font(.caption)
            }
        }
    }

    private func statusText(_ state: PhoneWidgetState) -> String {
        if let label = state.partner.status?.label { return label }
        if let need = state.partner.mood?.need, need != "nothing" { return "Needs \(need.replacingOccurrences(of: "_", with: " "))" }
        if let mood = state.partner.mood?.mood { return mood.capitalized }
        return "Togetherly"
    }
    private func moodEmoji(_ mood: String?) -> String {
        switch mood { case "amazing": return "🥰"; case "good": return "😊"; case "okay": return "🙂"; case "low": return "😔"; case "frustrated": return "😤"; case "overwhelmed": return "😫"; case "tired": return "😴"; case "stressed": return "😣"; default: return "♡" }
    }
    private func daysUntil(_ raw: String) -> String {
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: raw) else { return "Next visit soon" }
        let days = max(0, Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0)
        return days == 0 ? "Together today ♡" : "\(days) days until your visit"
    }
}

struct TogetherlyPartnerWidget: Widget {
    let kind = "TogetherlyPartnerWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PhoneProvider()) { entry in
            PhonePartnerView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Togetherly Partner")
        .description("Your partner's status, local time and next visit.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct PhoneLoveView: View {
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            Button(intent: PhoneLoveIntent()) {
                Image(systemName: "heart.fill").font(.title2).foregroundStyle(neutralAccent)
            }
            .buttonStyle(.plain)
        }
    }
}

struct TogetherlyLoveWidget: Widget {
    let kind = "TogetherlyLoveWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PhoneProvider()) { _ in
            PhoneLoveView().containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Love Tap")
        .description("Send love straight from your Lock Screen.")
        .supportedFamilies([.accessoryCircular])
    }
}

@main
struct TogetherlyWidgetBundle: WidgetBundle {
    var body: some Widget {
        TogetherlyPartnerWidget()
        TogetherlyLoveWidget()
    }
}
