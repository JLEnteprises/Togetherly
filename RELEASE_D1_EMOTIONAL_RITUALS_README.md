# Togetherly Release D1 — Emotional Rituals

D starts with the two emotional flows that already work but still lose important state when a screen is closed or another device responds.

## Mood support is now persistent

Before D1, the Mood screen remembered "Support sent" only in component state. Closing the screen forgot it, and Home could continue treating that same check-in as the highest-priority thing even after support had already been sent.

D1 adds persistent mood acknowledgements:

- "I'm here for you" is stored once per mood/person;
- reopening Mood still shows **Support sent**;
- duplicate taps do not send duplicate partner notifications;
- acknowledgements from Watch use the same persisted record;
- Home stops surfacing an acknowledged check-in as unresolved support.

## Daily Question reveal becomes a real ritual state

Before D1, tapping **Reveal our answers** only changed local React state. Reopening the page asked you to reveal the same answers again, and Home continued to say "ready to reveal."

D1 persists reveal per person/day:

- both answers must exist before reveal is accepted server-side;
- each partner chooses when *they* reveal;
- reopening the app remembers that you already revealed;
- Home changes from **ready to reveal** to **revealed** after you do it;
- the partner's reveal choice remains independent.

## Migration required

D1 adds migration `016_emotional_rituals.sql`.

Apply:

```cmd
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_D1_EMOTIONAL_RITUALS.js
npm.cmd run backend:migrate
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic
```

If `RELEASE_D1_EMOTIONAL_RITUALS_AUDIT_REMAINING.txt` appears, send it before committing.

## Manual test

Mood:
1. Have one account share a Mood with a need.
2. Other account taps **I'm here for you**.
3. Leave/reopen Mood: it should still say **Support sent**.
4. Home should no longer make that acknowledged mood the priority card.

Daily Question:
1. Both answer.
2. Reveal on one phone.
3. Leave/reopen Daily Question: answers should remain revealed for that account.
4. On the other account, the reveal should still wait until that person taps Reveal.
