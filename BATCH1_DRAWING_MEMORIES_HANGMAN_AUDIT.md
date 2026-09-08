# Togetherly v1.14.3 — Batch 1 Function Audit

Scope: Drawing/Scratchpad/Draw Together, Memories/Photos/Albums, Hangman, and the reported “every day” copy issue.

## Drawing / Scratchpad / Draw Together

### Problems found
- The drawing canvas used `PanResponder`, but it did not capture the gesture before a parent `ScrollView` could claim it on iPhone. This matches the reported behaviour where the page scrolls instead of drawing.
- Strokes only stored width/user/points, so richer brush colours and styles could not survive a save/realtime round trip.
- Draw Together and the full Scratchpad had no real drawing tool palette.

### Changes
- The canvas now captures touch gestures at the capture phase and rejects responder termination while a drawing gesture is active. The canvas now also explicitly locks the surrounding `AppScreen` ScrollView while the finger is on the drawing canvas or colour wheel, then re-enables scrolling on release/cancel. This is in addition to responder capture, so iPhone page scrolling is disabled specifically during drawing interactions.
- Added a colour wheel with saturation and shade choices.
- Added Pen, Marker, Highlighter and Eraser tools.
- Added Thin, Medium and Thick brush sizes.
- Added per-stroke `color`, `opacity` and `tool` metadata while keeping old strokes backward compatible.
- Scratchpad and Draw Together backend validation now preserves and sanitises the new brush metadata.
- Full Scratchpad gets the full tool palette. The compact Home scratchpad keeps its simpler controls so Home does not become oversized.
- Draw Together gets the full tool palette.
- Existing undo and clear behaviour remains in place.

### Compatibility
Old saved strokes without colour/style metadata still render using the existing participant-colour fallback. No database migration is required because drawings are JSON metadata/state.

## Memories / Photos / Albums

### Existing implementation verified
- Memories already support up to 8 photos in the picker and backend.
- The backend stores all photo URLs in `memory_media`, keeps the first photo in the legacy `photo_url` compatibility field, and returns ordered `photos` arrays.
- Albums link memories rather than cloning them, which is the correct data model: removing a memory from an album should not delete the underlying memory.

### Problems found
- Tapping a photo in Photos routed to `memories?focus=...`, and the Memories screen interpreted `focus` as “begin editing”. That is why looking at a photo opened the editor.
- Memories did not have a dedicated detail view separate from editing.
- Album detail only rendered one image per linked memory, hiding the rest of a multi-photo memory.
- Removing an item from an album did not update the album `updated_at` timestamp.

### Changes
- Added a dedicated Memory detail modal showing title, creator, date, location, description/story, milestone/tags and all attached photos.
- Tapping a photo now opens a full-screen photo viewer instead of Edit.
- Tapping the text/body of a Memory opens the Memory detail card.
- Edit remains an explicit action from the detail view/menu.
- `focus=` now means “open the Memory”; a separate `edit=` parameter is used for direct editing.
- Album detail is now grouped by Memory. Each group shows Memory title/date/location/description and every attached photo, rather than only one cover image.
- Album photo taps open the same full-screen viewer.
- Removing a Memory from an Album updates the Album timestamp while leaving the original Memory untouched.

## Hangman

### Problem found
The backend already preserved spaces in phrases, but the client transformed the entire masked phrase into one character-spaced string. Word boundaries were therefore visually weak/ambiguous.

### Change
Hangman now renders each word as its own grouped row of letter slots with a larger gap between words and displays the word count. Spaces remain visible as true word boundaries while apostrophes/hyphens remain part of their word.

## Copy fix
Changed “sharing everyday life” to “sharing every day of life”.

## Regression checks added
Server smoke coverage was strengthened to check:
- multi-photo Memories remain multi-photo inside Albums;
- removing a Memory from an Album does not delete/alter the Memory;
- Hangman phrase masking preserves spaces;
- Draw Together preserves custom stroke colour/tool/opacity across the backend.

## Verification performed here
- Syntax/transpile diagnostics passed for all 13 modified TypeScript/TSX files.
- Static client/backend route tracing was completed for the audited features.

A full project typecheck and PostgreSQL smoke run cannot be completed from this packaged source snapshot because it does not include the installed dependency tree or a running project database. Run the normal project checks after applying this overlay.

## Deferred intentionally
A new “Draw & Guess” / old-school Draw Something-style competitive couples mode is a strong fit, but it is not added in this patch. It needs its own game state (private prompt for drawer, guesser state, rounds/timer/scoring) and is better handled as the next focused game batch rather than mixed into this bug-fix pass.
