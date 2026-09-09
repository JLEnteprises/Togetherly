# Togetherly Release A2 — Me / Partner / Us Visual Language

This is the second half of Release A.

The colour foundation is already installed. This pass makes the meaning of those colours consistent:

- Neutral = Togetherly / generic UI
- Your colour = you
- Partner colour = partner
- Both colours = us / couple-owned content

## What changes

- Adds `ParticipantIdentityBadge` with avatar + `YOU`, `PARTNER`, or `US`.
- Attribution now labels the other person as `PARTNER`, not just the current user as `YOU`.
- Tasks use the **assignee** identity for the strong card rail and checkbox.
- Calendar events use the **assigned person / both** identity for the strong card rail.
- Shared notes use both colours; private notes use their owner's colour.
- Lists, goals, memories, trips, countdowns and date ideas use the couple's dual identity because they are shared content, while still showing who added them.
- Goal contribution chips show the participant plus their contribution.
- Home partner-support cards get the partner identity rail and badge.
- Long-distance clocks are explicitly labelled with YOU/PARTNER badges.
- Mood cards use identity badges rather than expecting colour alone to communicate whose check-in it is.
- No database migration and no backend behaviour changes.

## Apply

Extract over the project root, then:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_A2_IDENTITY_SEMANTICS.js
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_A2_IDENTITY_AUDIT_REMAINING.txt` appears, send it before committing.
