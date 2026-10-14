# Offline saves and task controls

This release adds durable device saves for tasks (including steps and completion), notes, and mood check-ins. A signed-in user must have loaded their couple workspace online first. Cached screens remain readable during an outage. Other mutations, including photo uploads, date plans and capsules, still require a connection; this is the first offline release, not complete offline coverage.

## What the user sees

- Changes save locally before sending. A banner distinguishes pending device saves from changes confirmed by the server.
- Automatic sync retries while the app is active, backing off from 5 to 60 seconds after failures, and runs when the app returns to the foreground. Retry sync is also available. Closed/background iOS execution is not guaranteed.
- Before replay, the app refreshes the published API address. Network failures and tunnel gateway failures also trigger address refresh. The cached address remains useful when configuration hosting itself is unreachable; polling does not make an expired tunnel valid. The tunnel owner must publish its current address.
- A temporary token-refresh outage preserves the saved login. An explicitly invalid session still requires sign-in.
- The partner does not need to be online when a change saves. Shared changes reach the server and become available to the partner once synchronization succeeds. Private check-ins stay private.
- Conflicts retain the local change and pause the queue. Review changes shows the pending content. Copy anything needed, discard pending changes, refresh the latest server item, and reapply the intended edit. Discard currently affects the whole pending queue; automatic conflict merging is not implemented.
- Daily recurrence reads “Every day”. Tasks have a direct Done action; Start is reserved for tasks with steps. The detail sheet has tappable step checkboxes and Done/Reopen.

## Delivery guarantees and boundaries

The outbox is persisted per user and couple space. Each request keeps the same operation ID and prepared payload across retries, including a lost response or restart. On the server, the mutation and receipt commit in one database transaction. Notifications and realtime broadcasts are deferred until commit. Membership is checked on every replay, and existing-row edits/deletions require their recorded revision. Locally acknowledged revisions can be rebased for subsequent queued edits; another device's changes cause a conflict.

Check-ins retain their device recording time. Expired check-ins are stored without notifying the partner as though they were new.

Pending content survives app restarts and sign-out but is accessible only after signing back into its original user and couple context. Deleting the app or clearing its storage removes unsynced content. Local content uses the app's existing AsyncStorage persistence; this change does not add an encrypted local database. Attachments and full offline coverage remain future work.

## Deployment order

1. Back up the database and deploy this server version.
2. From `server`, run `npm run migrate` against the actual server database, including migration `022_offline_receipts.sql`, then build/restart the server using the existing deployment procedure. This migration is additive. Do not remove receipt rows while delayed clients can replay operations.
3. Confirm authenticated `GET /sync/capabilities` returns `{ "version": 1 }`.
4. Build and install the updated app on both phones. A GitHub source update alone does not install a new native app. Runtime API-address configuration can change independently of the app binary.

An older server cannot accept queued operations. They remain pending, and a 404 needs review; deploy the backend before distributing the client.

## Verification

From the repository root: `npx tsc --noEmit`.
From `server`: `npm run typecheck`, `npm run test:offline`, and `npm run test:experience`.

Automated coverage includes durable restart, lost-response replay, duplicate suppression, dependent task/step IDs, local revision rebasing, conflict retention, account/couple separation, failed storage writes, transaction rollback including notifications, and private/expired check-ins. Database tests use PGlite. Native two-phone verification remains required: airplane-mode edits, force-close/reopen, restored connectivity, tunnel-address change, partner updates, and conflict review.
