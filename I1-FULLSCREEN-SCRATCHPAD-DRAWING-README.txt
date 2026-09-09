Togetherly v1.14.3 — Release I1: Fullscreen Scratchpad Drawing

Verified baseline
-----------------
GitHub head:
c6cda41aaab58276c44c7df24420ae73f0af01a9

H3 was verified as one clean commit above H2 with exactly its intended nine files.

I1 goal
-------
Give Scratchpad Draw mode a genuine fullscreen drawing workspace while keeping:
- the same Shared Scratchpad record
- the same unsaved in-memory strokes
- the same Save operation
- partner presence
- remote-update conflict protection
- participant ownership colours
- Undo mine
- Clear

This does NOT create a second scratchpad.

How it works
------------
The dedicated Scratchpad screen still uses SharedScratchpadCard.

When Draw mode is active, it now shows:
Full screen

That opens:
src/components/scratchpad/FullscreenScratchpadDrawing.tsx

The fullscreen workspace is a Modal mounted by the existing SharedScratchpadCard.
Because it is mounted inside the same component state:

- unsaved strokes remain visible when entering fullscreen
- strokes made fullscreen immediately exist in normal Scratchpad
- closing fullscreen does not save or discard anything
- Save uses the exact existing saveSharedScratchpad flow
- conflict protection remains the existing remoteUpdate flow
- partner presence remains the existing scratchpad presence session

Fullscreen layout
-----------------
Top:
- Close
- partner presence indicator
- Save

Main:
- large shared drawing canvas

Compact tools:
- Pen
- Marker
- Highlighter
- Eraser
- Size (cycles S / M / L)
- Colour
- Colour opens a collapsible colour drawer over the canvas instead of permanently consuming screen space

Bottom:
- Undo mine
- Clear
- Saved / Unsaved status

DrawingCanvas
-------------
DrawingCanvas gains:
compactTools?: boolean

Normal Scratchpad keeps the existing full colour wheel + brush + size controls.

Fullscreen uses compactTools.

I1 intentionally does NOT perform I2 optimizations
--------------------------------------------------
The following current behavior is deliberately preserved for I2:
- slice(-120) stroke retention limit
- JSON.stringify(strokes) dirty comparison
- committed strokes rerender during live movement
- draft React state update per sampled PanResponder move
- current ~500-point per-stroke cap

This separation lets I2 be an explicit performance-hardening phase rather than mixing behavior and layout changes.

Files changed
-------------
src/app/features/scratchpad.tsx
src/components/dashboard/SharedScratchpadCard.tsx
src/components/common/DrawingCanvas.tsx
src/components/scratchpad/FullscreenScratchpadDrawing.tsx

No migration.
No dependency changes.

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_I1_FULLSCREEN_SCRATCHPAD_DRAWING.js

Automatic validation:
1. npm.cmd run typecheck
2. npm.cmd --prefix server run typecheck
3. npm.cmd --prefix server run logic

Successful finish:
[I1] ALL VALIDATIONS PASSED

Safety
------
- G5/G6/H1/H2/H3 markers are checked before writes
- every output is prepared before the first source write
- pre-existing unrelated FullscreenScratchpadDrawing.tsx is never overwritten
- CRLF/LF style is preserved
- safe to run twice
- source audit explicitly verifies I2 performance behavior was NOT silently changed
