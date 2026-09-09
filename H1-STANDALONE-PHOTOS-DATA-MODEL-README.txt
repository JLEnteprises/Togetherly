Togetherly v1.14.3 — Release H1: Standalone Photos Backend / Data Model

Verified baseline
-----------------
GitHub head:
c477d034564910f4bf3c1062ab14bbc88d6b555f

G6 was verified as one clean commit above G5 with exactly the intended G6 files.

H1 goal
-------
Photos become first-class content in the data model.

A standalone Photo can:
- exist without a Memory
- optionally link to one Memory
- have a creator
- have an optional caption
- have an optional taken-at timestamp
- belong to one or more photo-based Albums

This phase is backend/data-model only.
The visible Photos screen is intentionally migrated in H2.

Migration
---------
Adds:

server/migrations/018_standalone_photos.sql

New tables:
- photos
- photo_albums
- photo_album_items

Important compatibility rule:
- memory_media is NOT changed
- memory_albums is NOT changed
- memory_album_items is NOT changed
- existing Memory photos are NOT copied/deleted/re-written in H1

That compatibility bridge belongs to H3 so existing user photos are never silently lost.

New server API
--------------
Photos:
- GET /photos
- GET /photos/:id
- POST /photos
- PATCH /photos/:id
- DELETE /photos/:id

Photo Albums:
- GET /photo-albums
- POST /photo-albums
- GET /photo-albums/:id
- PATCH /photo-albums/:id
- DELETE /photo-albums/:id
- POST /photo-albums/:id/photos
- DELETE /photo-albums/:id/photos/:photoId

Photos use the same authenticated JPEG/PNG/WebP data-URL or HTTPS URL validation already used by Memories.

New client API/types
--------------------
src/services/backend/photos.ts

Provides:
- getPhotos
- getPhoto
- createPhoto
- updatePhoto
- deletePhoto
- getPhotoAlbums
- createPhotoAlbum
- updatePhotoAlbum
- getPhotoAlbum
- addPhotoToAlbum
- removePhotoFromAlbum
- deletePhotoAlbum

src/types/database.ts adds:
- CouplePhoto
- PhotoAlbum

Files changed
-------------
server/migrations/018_standalone_photos.sql
server/src/routes/photos.ts
server/src/app.ts
src/types/database.ts
src/services/backend/photos.ts

Install — Windows CMD
---------------------
Extract this ZIP into:

C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere

Then run:

cd C:\Users\Liam\Downloads\Togetherly-v1.14-Everywhere
node APPLY_RELEASE_H1_STANDALONE_PHOTOS_DATA_MODEL.js

The installer automatically runs:
1. npm.cmd --prefix server run migrate
2. npm.cmd run typecheck
3. npm.cmd --prefix server run typecheck
4. npm.cmd --prefix server run logic

Migration 018 is therefore applied automatically.

Safety
------
- completed G1–G6 markers are checked before writes
- migration 017 must exist before H1 will choose migration number 018
- all modified outputs are prepared before any source write
- CRLF/LF style is preserved
- unrelated pre-existing H1 target files are never overwritten
- installer is safe to run twice
- legacy Memory photo/album architecture is audited after install and left intact

Checkpoint only after:
[H1] ALL VALIDATIONS PASSED
