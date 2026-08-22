# Togetherly v1.8 — Everyday Usability Audit

## Product goal

Togetherly should be **feature rich underneath and calm on the surface**. The default path should answer “what matters now?” while deeper controls remain one or two taps away.

The working rule for this pass is:

> **Default = now. Second tap = everything. More options = power-user depth.**

## Home — keep calm, make it useful

### Finding
v1.6 correctly removed the old 11-card dashboard, but moving Scratchpad entirely into Notes made a genuinely everyday feature less useful. Scratchpad is different from a saved Note: it is the shared piece of paper you both expect to see immediately.

### v1.8 change
Home now has at most four configurable sections after the couple hero:

1. **Today** — next event, smart task attention, Daily Question and mood.
2. **Scratchpad** — compact shared **Text / Draw** editor.
3. **Long Distance** — local times, countdown and free-time overlap, only when relevant.
4. **Quick actions** — Play, Date idea, Tasks and Memory.

Scratchpad is directly editable on Home but also remains under Notes for a larger editor. Home layout remains optional and reorderable.

### Why this stays clean
Scratchpad does not create a new feature category or navigation tile. It is one compact utility card and can be hidden from Home.

## Scratchpad — change from “note” to “shared surface”

### Finding
The old Scratchpad only accepted text even though v1.7 introduced a reusable drawing engine.

### v1.8 change
Scratchpad now supports:

- **Text mode** for reminders, numbers, links and quick notes.
- **Draw mode** for a sketch, doodle, handwritten cue or visual idea.
- Switching modes without deleting the other form of content.
- Participant-coloured strokes.
- Undo-my-last-stroke and clear-canvas controls.
- Realtime refresh after save.
- A conflict cue when the partner updates the scratchpad while you have unsaved local changes; Togetherly does not silently erase your draft.

The backend stores scratchpad drawing data as structured JSON metadata rather than embedding a giant drawing string into the text field.

## Tasks — default to attention, keep full depth

### Finding
v1.7 added the right power features — due date, attention/start date, estimated duration and dated checklist steps — but a long Open list still makes the user mentally determine what matters today.

### v1.8 change
Tasks now open on **Now**:

- overdue tasks;
- high-priority unfinished tasks;
- tasks whose explicit or duration-derived attention window has started;
- tasks with incomplete checklist steps due today or overdue.

The existing **Open / All / Done** views remain one tap away. Items in the visible list are ordered with high-priority work first and then by attention/due date.

Creation remains simple: title + assignment first; timing, recurrence, tags and checklist depth stay behind **More options**.

## Daily Question — ritual first, configuration second

### Finding
The actual daily interaction was followed by eleven category toggles every day. That made a once-in-a-while setting visually compete with the ritual itself. Past answers were saved by the database but could not be browsed.

### v1.8 change
Daily Question now has:

- **Today** — the existing hidden-until-both-answer ritual.
- **History** — previous questions and answers, with the same reveal privacy rule.
- **Question settings** collapsed by default; category toggles appear only when opened.

History never sends a partner answer to the client unless both people answered that day.

## Plan

### Keep
The v1.6 grouping remains strong:

- Organise — Tasks, Lists, Notes
- Dates & time — Calendar, Countdowns, Availability
- Bigger plans — Trips, Goals
- Organisation tools — Tags

### Future candidate, not added now
A universal “Add” button could create Task / Event / Note / List item from anywhere, but adding another permanent control before real-use data shows a need would risk clutter. Keep creation inside each feature for now.

## Together / Play Together

### Keep
Play Together remains the main entertainment entry point. Relationship Bingo, Hangman, This or That, Know Me and Draw Together remain bundled rather than becoming separate top-level features.

### v1.8 polish
Together’s hero copy now explicitly includes Draw Together so the drawing feature is discoverable.

### Future candidates
- Doodle Guess using the existing stroke engine.
- A tiny “resume last game” shortcut on Home only when a game is active, rather than a permanent game card.

## Notes

### Keep
Saved Notes and Scratchpad should remain different concepts:

- **Notes** = durable records, titles, privacy, tags, pins.
- **Scratchpad** = one shared temporary surface, always easy to reach.

Scratchpad therefore lives in both Home and Notes without duplicating data.

## Calendar / Countdowns / Availability

### Keep
These are already consolidated under Dates & time and summarized on Home only when useful. No extra Home cards should return.

### Future candidate
An optional “Today” agenda could combine events and task-step deadlines, but Home Today already provides enough summary for v1.

## Trips and Goals

### Keep
These are correctly treated as bigger plans rather than everyday Home content. Trip Planner can link into the rest of the product rather than duplicating lists/calendar/countdowns.

## Memories / Us

### Keep
The v1.6 Our Story parent model is the right abstraction. Photos, Albums, Timeline and Memory Jar should remain views over the same memory system rather than peer features.

### Future candidate
Allow a Daily Question History entry or saved drawing to be promoted into a Memory with one action. This creates connection between features without adding more navigation.

## Search / Notifications / More

### Keep
Search and account/settings belong under More. They do not deserve Home real estate.

### Future candidate
A small unread notification badge on the More tab is more useful than a permanent Notifications card on Home.

## Release conclusion

v1.8 intentionally adds **depth without adding top-level complexity**. The major everyday flows now follow the same pattern:

- Home tells you what matters.
- Scratchpad captures something immediately.
- Tasks default to what needs attention.
- Daily Question defaults to today.
- History/settings/deeper configuration stay available without competing with the daily action.
