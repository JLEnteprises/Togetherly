# Togetherly Batch 3 — Connection / Daily Rituals Audit

Audited against the current `JLEnteprises/Togetherly` main branch on 2026-09-08.

## Scope
- Daily Question
- Mood check-ins and support acknowledgement
- Notification inbox/settings
- Realtime notification refresh behaviour
- Relationship ping plumbing reviewed at service/type level

## Fixes applied

### Daily Question
Current question selection depends on the enabled category list. Before this patch, either partner could change category preferences after somebody had already answered, which could make `loadTodaysQuestion()` choose a different question for the same date and strand the existing answer.

Fix: once any answer exists for the couple for today's date, category preferences return a 409 and must be changed the next day before either partner answers.

The existing reveal boundary remains intact: partner answers are hidden until both have answered, and answers cannot be edited after the reveal boundary.

### Mood check-ins
The screen's relative time text previously only recalculated when React happened to re-render. It now updates once per minute while the screen is open.

The backend acknowledgement endpoint previously allowed the same shared mood to be acknowledged repeatedly. A reinstall, refresh or another client could therefore generate duplicate "I'm here for you" notifications.

Fix: acknowledgement is now idempotent per mood + sender + recipient. Repeated requests return success without creating another notification.

Private mood entries remain private; the partner query only reads shared entries.

### Notifications
The notification screen previously called the scheduled-reminder sweep during its generic `refresh()` function. Every realtime feature update then called that same function, causing a reminder sweep on unrelated task/list/memory/etc updates.

Fix: realtime changes now reload the inbox only. The reminder sweep still runs when the notification screen initially loads.

Deleting a notification also previously called the full refresh/sweep again. It now updates the local inbox and unread count directly after the delete succeeds.

### Relationship pings
The existing client service exposes `love` and `thinking_of_you` relationship ping creation, and the notification preference/type model already includes them. No schema migration was needed for this batch.

## Not changed
- Push entitlement/signing limitations for free Apple IDs
- Watch delivery/signing behaviour
- Notification scheduling thresholds
- Daily-question bank content
- Mood/need option vocabulary

## Verification
Run on the real Windows project:

```cmd
npm run typecheck
npm --prefix server run typecheck
```

Then manually test with both accounts:
1. Partner A answers Daily Question; Partner B tries to change question categories -> should be blocked for today.
2. Both answer -> reveal remains private until both answered.
3. Share a mood; partner taps "I'm here for you" twice/reopens screen -> only one support notification should exist.
4. Leave Mood open for several minutes -> relative timestamp should advance.
5. Open Notifications; create/update unrelated shared content -> inbox refreshes without forcing a reminder sweep each time.
6. Delete an unread notification -> unread count drops immediately.
