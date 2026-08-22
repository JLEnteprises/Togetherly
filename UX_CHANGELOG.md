# Togetherly v1.8 — Everyday Ease Changelog

## Home
- Restored Shared Scratchpad to Home as a compact configurable section.
- Home remains capped at four meaningful sections: Today, Scratchpad, Long Distance and Quick actions.
- Home layout storage moves to v3 so the new default order is applied cleanly.

## Shared Scratchpad
- Added Text / Draw modes using the reusable Togetherly drawing engine.
- Both text and drawing are retained when switching modes.
- Added participant-coloured drawing strokes, undo-my-stroke and clear canvas.
- Added a compact Home editor plus the existing full Scratchpad screen under Notes.
- Added a partner-update conflict cue so an incoming realtime update does not silently overwrite an unsaved local draft.
- Added structured shared-item metadata storage through migration 010.

## Tasks
- Added a default **Now** view for items that need attention.
- Now includes overdue work, high-priority unfinished work, active attention windows and due/overdue checklist steps.
- Open / All / Done remain available.
- Visible work is sorted by priority and attention/due date.

## Daily Question
- Added Today / History views.
- Past answers are now browsable instead of being database-only history.
- Historical partner answers obey the same hidden-until-both-answer privacy rule.
- Moved question-category toggles behind a collapsed Question settings section.

## Play Together
- Updated Together copy so Draw Together is visible in the main Play description.

## Verification
- Added smoke coverage for Scratchpad text/draw persistence and Daily Question History/reveal privacy.
- No new client dependency beyond the v1.7 `react-native-svg` drawing dependency.
