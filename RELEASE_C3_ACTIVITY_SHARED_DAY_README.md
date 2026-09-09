# Togetherly Release C3 — Activity Lifecycle & Shared Day

C3 finishes Release C by fixing the remaining two planning/timezone model issues.

## Date Ideas: favourite is no longer a lifecycle status

Before C3, `favourite` was stored in the same field as `planned`, `completed`, etc. That meant favouriting a planned idea silently destroyed its planned state.

C3 separates the concepts:

- lifecycle: **Want to do → Planned → Completed / Do again**
- preference: **Favourite yes/no**

So an idea can now be both **Planned + Favourite**, or **Do again + Favourite**, without one state erasing the other.

The randomiser also respects lifecycle now: it picks from Want to do, Planned, and Do again—not completed/skipped ideas.

Migration 015 converts existing `status='favourite'` rows into:

- `is_favourite=true`
- `status='want_to_do'`

The old design already discarded the previous lifecycle state, so there is no reliable way to reconstruct whether an old favourite used to be Planned/Completed. From C3 onward that information is preserved correctly.

## Daily Question: one shared relationship day

Before C3, Daily Question used UTC midnight. For long-distance couples that can switch the question in the middle of one partner's local day.

C3 gives each couple a stable `shared_day_timezone`.

For existing couples it is initialized from the couple owner's timezone at migration time. For new couples it is captured from the creator's timezone when the couple space is created.

That timezone is then used consistently by:

- Daily Question GET
- answering/edit-lock logic
- Daily Question category-setting lock
- Apple Watch Daily Question state

It is intentionally stable rather than following either person's travel timezone automatically, so both partners always remain on exactly the same question day.

## Migration required

After extracting:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_C3_ACTIVITY_SHARED_DAY.js
npm.cmd run backend:migrate
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_C3_ACTIVITY_SHARED_DAY_AUDIT_REMAINING.txt` appears, send it before committing.

## Manual checks

Activity:
1. Mark an idea Planned.
2. Favourite it.
3. Confirm it remains Planned and also shows Favourite.
4. Remove Favourite and confirm Planned remains.
5. Mark Done, then choose Do this again.

Daily Question:
1. Both phones should report the same question/date even if their local calendar dates differ.
2. Watch and phone should agree on the same Daily Question.
