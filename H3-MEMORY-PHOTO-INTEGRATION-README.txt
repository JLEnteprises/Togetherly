Togetherly v1.14.3 — Release H3: Memory / Photo Integration + Legacy Compatibility

Verified baseline
-----------------
GitHub head:
849e2b7a7a0f53bea1836b2836acb3d296f3d119

H2 was verified as one clean commit above H1 with exactly its intended seven files.

H3 goal
-------
Complete the Photos redesign without losing existing Memory photos or album organization.

Migration 019
-------------
Adds:
server/migrations/019_memory_photo_integration.sql

It is deliberately COPY/BRIDGE based.

It does NOT delete:
- memory_media
- memories.photo_url
- memory_albums
- memory_album_items

It adds memory_sort_order to first-class photos, then imports:

1. Existing memory_media images
   -> photos
   -> linked_memory_id points back to their Memory
   -> memory_media sort order is preserved

2. Older memories.photo_url fallback images
   -> photos
   -> linked back to the Memory

3. Existing Memory Albums
   -> corresponding photo_albums

4. Each Memory Album's contained Memories
   -> expanded into that album's linked Photos
   -> photo_album_items

So existing visible images and album organization survive the transition.

Memory creation/editing
-----------------------
Memories can now:
- choose existing standalone Photos
- upload new Photos
- mix existing + new
- keep up to 8 Photos total

New uploaded Memory images are immediately created as first-class Photos.
A Photo can be removed from a Memory without deleting it from the shared gallery.

If an existing selected Photo is already linked to another Memory, the server refuses the move instead of silently stealing it.

Deleting a Memory
-----------------
Deleting a Memory no longer deletes its first-class Photos.

The server explicitly unlinks them:
linked_memory_id = NULL

They stay in the shared Photos gallery and in any photo albums.

Photo interaction
-----------------
Memory text/card:
-> opens Memory detail

Memory photo:
-> opens the shared H2 fullscreen PhotoViewer

Memory detail photo:
-> also hands off to PhotoViewer

PhotoViewer's optional View memory action still works for linked Photos.

Server changes
--------------
New:
server/src/routes/memoryPhotos.ts

This owns:
- photo ID validation
- new image validation
- first-class Memory/Photo linking
- non-destructive unlinking
- Memory photo ordering
- legacy read fallback

server/src/routes/memories.ts now uses standalone Photos as the canonical Memory-photo association.

The legacy memory_media/photo_url representation remains as a fallback only.

Client changes
--------------
New:
src/components/memories/MemoryPhotoField.tsx

Updated:
src/app/features/memories.tsx
src/components/memories/MemoryDetailModal.tsx
src/services/backend/mvpFeatures.ts

Migration required
------------------
YES.

The installer automatically runs:
npm.cmd --prefix server run migrate

Expected migration:
019_memory_photo_integration.sql

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_H3_MEMORY_PHOTO_INTEGRATION.js

Automatic validation:
1. npm.cmd --prefix server run migrate
2. npm.cmd run typecheck
3. npm.cmd --prefix server run typecheck
4. npm.cmd --prefix server run logic

Successful finish:
[H3] ALL VALIDATIONS PASSED

Safety
------
- H1/H2 markers are required before any write
- all outputs are prepared before the first write
- existing legacy photo rows are copied, never deleted by migration
- existing Memory Album rows are copied, never deleted by migration
- unlinking a Photo from a Memory does not delete the Photo
- unrelated pre-existing H3 files are never overwritten
- CRLF/LF is preserved
- installer is safe to run twice
