import SwiftUI

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
private let ink = Color(red: 0.043, green: 0.039, blue: 0.059)

struct TogetherlyWatchHome: View {
    @EnvironmentObject var model: TogetherlyWatchModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    if let state = model.state {
                        partnerCard(state)
                        loveCard(state)
                        if let mood = state.partner.mood, mood.mood != nil {
                            moodCard(state, mood: mood)
                        }
                        todayCard(state)
                        relationshipCard(state)
                        NavigationLink {
                            QuickCheckInView()
                        } label: {
                            Label("Quick check-in", systemImage: "heart.text.square")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    } else {
                        connectState
                    }
                    if let lastMessage = model.lastMessage {
                        Text(lastMessage)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .transition(.opacity)
                    }
                }
                .padding(.horizontal, 4)
                .padding(.bottom, 8)
            }
            .background(ink)
            .navigationTitle("Togetherly")
        }
        .tint(neutralAccent)
    }

    private func partnerCard(_ state: WatchState) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Circle().fill(identityColor(state.partner.color)).frame(width: 8, height: 8)
                Text(state.partner.name).font(.headline).lineLimit(1)
                Spacer()
                Text(state.partner.localTime).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            if let label = state.partner.status?.label {
                Label(label, systemImage: statusIcon(state.partner.status?.kind))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text(model.connectionLabel).font(.caption2).foregroundStyle(.secondary)
            }
        }
        .togetherlyCard()
    }

    private func loveCard(_ state: WatchState) -> some View {
        VStack(spacing: 9) {
            ZStack {
                Circle().stroke(identityColor(state.me.color).opacity(0.35), lineWidth: 1).frame(width: 70, height: 70)
                Circle().stroke(identityColor(state.partner.color).opacity(0.28), lineWidth: 1).frame(width: 54, height: 54)
                Image(systemName: "heart.fill").font(.system(size: 28, weight: .semibold)).foregroundStyle(neutralAccent)
            }
            Button {
                Task { await model.sendPing("love") }
            } label: {
                Text("Send love").fontWeight(.semibold).frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(neutralAccent)
            .disabled(model.isSending)

            Button {
                Task { await model.sendPing("thinking_of_you") }
            } label: {
                Label("Thinking of you", systemImage: "sparkles")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .disabled(model.isSending)
        }
        .togetherlyCard()
    }

    private func moodCard(_ state: WatchState, mood: WatchMood) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("HOW THEY'RE DOING").font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
            HStack(spacing: 6) {
                Text(moodEmoji(mood.mood)).font(.title3)
                VStack(alignment: .leading, spacing: 1) {
                    Text((mood.mood ?? "Check-in").capitalized).font(.caption).fontWeight(.semibold)
                    if let need = mood.need, need != "nothing" { Text("Needs \(need.replacingOccurrences(of: "_", with: " "))").font(.caption2).foregroundStyle(.secondary) }
                }
                Spacer()
            }
            if mood.need != nil && mood.need != "nothing" {
                Button("I'm here ♡") { Task { await model.acknowledgeMood() } }
                    .buttonStyle(.bordered)
                    .font(.caption)
                    .disabled(model.isSending)
            }
        }
        .togetherlyCard()
    }

    private func todayCard(_ state: WatchState) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TODAY").font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
            if state.dailyQuestion.bothAnswered {
                Label("Answers ready to reveal", systemImage: "sparkles").font(.caption).foregroundStyle(neutralAccent)
            } else if !state.dailyQuestion.meAnswered {
                Label("Daily Question is waiting", systemImage: "questionmark.bubble").font(.caption)
            } else if !state.dailyQuestion.partnerAnswered {
                Label("Waiting for \(state.partner.name)", systemImage: "hourglass").font(.caption).foregroundStyle(.secondary)
            } else {
                Label("Daily Question complete", systemImage: "checkmark.circle").font(.caption)
            }
            if let question = state.dailyQuestion.question?.question {
                Text(question).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
            }
        }
        .togetherlyCard()
    }

    private func relationshipCard(_ state: WatchState) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            if let visit = state.nextVisit {
                HStack {
                    Label("Next visit", systemImage: "heart.circle")
                    Spacer()
                    Text(daysUntil(visit.target_at)).fontWeight(.bold).foregroundStyle(neutralAccent)
                }
                .font(.caption)
                Text(visit.title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            } else if let days = state.relationship.days {
                HStack {
                    Label("Together", systemImage: "infinity")
                    Spacer()
                    Text("\(days) days").fontWeight(.semibold)
                }
                .font(.caption)
            }
        }
        .togetherlyCard()
    }

    private var connectState: some View {
        VStack(spacing: 10) {
            Image(systemName: "iphone.and.arrow.forward").font(.system(size: 34)).foregroundStyle(neutralAccent)
            Text("Connect Togetherly").font(.headline)
            Text("Open Togetherly on your iPhone once to pair this Watch and sync your relationship.")
                .font(.caption2).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Button("Try again") { Task { await model.refresh() } }.buttonStyle(.bordered)
        }
        .padding(.top, 20)
    }

    private func statusIcon(_ kind: String?) -> String {
        switch kind { case "sleep": return "moon.fill"; case "work": return "briefcase.fill"; case "busy": return "circle.dashed"; case "free": return "sparkles"; default: return "circle.fill" }
    }
    private func moodEmoji(_ mood: String?) -> String {
        switch mood { case "amazing": return "🥰"; case "good": return "😊"; case "okay": return "🙂"; case "low": return "😔"; case "frustrated": return "😤"; case "overwhelmed": return "😫"; case "tired": return "😴"; case "stressed": return "😣"; default: return "♡" }
    }
    private func daysUntil(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: iso) else { return "Soon" }
        let days = max(0, Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0)
        return days == 0 ? "Today" : "\(days)d"
    }
}

private struct QuickCheckInView: View {
    @EnvironmentObject var model: TogetherlyWatchModel
    @Environment(\.dismiss) var dismiss
    @State private var mood = "good"
    @State private var need = "affection"

    private let moods = [("amazing","🥰"),("good","😊"),("okay","🙂"),("low","😔"),("overwhelmed","😫"),("tired","😴"),("stressed","😣")]
    private let needs = [("affection","Affection"),("reassurance","Reassurance"),("listen","Listen"),("call","Call me"),("space","Space"),("nothing","Nothing")]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("How are you?").font(.headline)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                    ForEach(moods, id: \.0) { item in
                        Button("\(item.1) \(item.0.capitalized)") { mood = item.0 }
                            .buttonStyle(.bordered)
                            .tint(mood == item.0 ? identityColor("purple") : .gray)
                            .font(.caption2)
                    }
                }
                Text("What do you need?").font(.headline)
                ForEach(needs, id: \.0) { item in
                    Button {
                        need = item.0
                    } label: {
                        HStack { Text(item.1); Spacer(); if need == item.0 { Image(systemName: "checkmark") } }
                    }
                    .buttonStyle(.plain)
                    .font(.caption)
                }
                Button("Share check-in") {
                    Task { await model.checkIn(mood: mood, need: need); dismiss() }
                }
                .buttonStyle(.borderedProminent)
                .tint(neutralAccent)
                .disabled(model.isSending)
            }
        }
        .navigationTitle("Check in")
    }
}

private extension View {
    func togetherlyCard() -> some View {
        self.padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(.white.opacity(0.08), lineWidth: 0.5))
    }
}
