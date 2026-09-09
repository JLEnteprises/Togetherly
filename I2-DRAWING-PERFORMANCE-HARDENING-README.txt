Togetherly v1.14.3 — Release I2: Drawing Performance Hardening

Verified baseline: 6075365d9ae5cf5106ca46824d9bbf9c4b4c338c

I2 implements:
- memoized committed stroke paths
- separate committed/live SVG layers
- requestAnimationFrame throttling for the live draft
- minimum-distance point sampling
- post-stroke simplification
- removal of the old 500-point truncation
- removal of the old 120-stroke disappearing behavior
- mutation-based drawing dirty state instead of JSON.stringify(strokes)

Preserved:
- DrawingStroke data format
- participant ownership colours
- partner presence
- remote-update conflict protection
- optimistic updatedAt protection
- I1 fullscreen drawing
- Save / Undo mine / Clear behavior

Files changed:
src/components/common/DrawingCanvas.tsx
src/components/dashboard/SharedScratchpadCard.tsx

No migration.
No dependency changes.

Install:
cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_I2_DRAWING_PERFORMANCE_HARDENING.js

Automatic validation:
npm.cmd run typecheck
npm.cmd --prefix server run typecheck
npm.cmd --prefix server run logic

Success:
[I2] ALL VALIDATIONS PASSED
