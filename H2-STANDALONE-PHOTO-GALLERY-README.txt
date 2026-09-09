Togetherly v1.14.3 — Release H2: Standalone Photo Gallery + Fullscreen Viewer

Verified baseline
-----------------
GitHub head:
bbcce28def7e16ff9fb1010cb9a01f1b6105ba2f

H1 was verified one commit ahead of G6 with exactly its intended seven files.

H2 goal
-------
Move the visible Photos experience onto the first-class H1 Photo model.

The Photos screen no longer builds its gallery from Memory photos.

All photos
----------
- reads GET /photos
- + Add photos uploads directly to standalone Photos
- no Memory is required
- multi-photo selection uses the existing image picker
- optional caption can be applied to the selected upload batch
- cards keep creator identity colour
- delete removes the standalone Photo and its photo-album memberships
- deleting a Photo does not delete a linked Memory

Fullscreen viewer
-----------------
New:
src/components/photos/PhotoViewer.tsx

Behavior:
- first photo tap opens the photo itself
- fullscreen modal
- horizontal swipe/paging between the current gallery set
- close action
- current photo counter
- caption/date information
- Linked to: Memory title when present
- optional View memory action when linked_memory_id exists

View memory routes to:
/features/memories?focus=<memory id>

So a photo tap no longer routes through MemoryDetailModal.

Photo albums
------------
The Photos Albums view now uses:
- photo_albums
- photo_album_items

Albums contain individual Photos, not Memory records.

Supported UI:
- create photo album
- edit name/description
- open album
- choose existing standalone Photos
- remove an individual Photo from an album
- delete album without deleting its Photos
- open album Photos directly in the fullscreen viewer

Realtime
--------
H1 already broadcasts resource:
photos

H2 adds photos to the client RealtimeResource union and subscribes:
useRealtimeRefresh('photos', ...)

The Us > Photos summary now reads getPhotos/getPhotoAlbums too, so its count matches the actual standalone gallery.

Compatibility boundary
----------------------
H2 intentionally does NOT migrate legacy memory_media rows into standalone Photos.

Existing Memory data remains untouched.

H3 is the compatibility/integration phase that will:
- preserve/import existing Memory photos
- let Memories select existing standalone Photos
- link newly uploaded Memory photos into the Photo model
- complete the transition without losing old user photos

Files changed
-------------
src/app/features/photos.tsx
src/components/photos/PhotoViewer.tsx
src/components/common/MultiPhotoPickerField.tsx
src/services/backend/realtime.ts
src/components/us/UsStoryDashboard.tsx

No migration
------------
H2 does not add or run a new database migration.
H1 migration 018 is already the required data foundation.

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_H2_STANDALONE_PHOTO_GALLERY.js

The installer automatically runs:
1. npm.cmd run typecheck
2. npm.cmd --prefix server run typecheck
3. npm.cmd --prefix server run logic

A successful install ends with:

[H2] ALL VALIDATIONS PASSED

Safety
------
- completed G1–G6 and H1 markers are checked before writes
- all H2 outputs are prepared before any source write
- exact old Photos architecture anchors are checked before its full replacement
- a pre-existing unrelated PhotoViewer file is never overwritten
- CRLF/LF style is preserved
- safe to run twice
- no migration or dependency change
