import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { broadcast, dateTimeOrNull, imageDataOrUrl, notifyPartner, optionalText, requiredText, requireCoupleId } from './helpers.js';

function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ApiError(400, 'Invalid identifier.');
  return value;
}
function planInput(body: Record<string, unknown>) {
  const title = requiredText(body.title, 'Plan title', 200);
  const start = dateTimeOrNull(body.startAt, 'Start');
  const end = dateTimeOrNull(body.endAt, 'End');
  if (!start || !end || Date.parse(start) <= Date.now() || Date.parse(end) <= Date.parse(start) || Date.parse(end) - Date.parse(start) > 86400000) throw new ApiError(400, 'Choose a future time lasting up to 24 hours.');
  return { title, start, end };
}
// Never return a sealed capsule's contents to either device, including the sender.
const capsuleProjection = `id,couple_id,creator_id,title,opens_at,created_at,opens_at <= now() AS opened,
 CASE WHEN opens_at <= now() THEN body ELSE NULL END AS body,
 CASE WHEN opens_at <= now() THEN photo_url ELSE NULL END AS photo_url`;

export async function registerExperienceRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/date-proposals', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query('SELECT * FROM date_proposals WHERE couple_id=$1 ORDER BY start_at DESC LIMIT 100', [coupleId]);
      return reply.send({ proposals: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/date-proposals', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const id = uuid(body.id);
      const input = planInput(body);
      const partner = await pool.query('SELECT 1 FROM couple_members WHERE couple_id=$1 AND user_id<>$2', [coupleId, request.userId]);
      if (!partner.rowCount) throw new ApiError(400, 'Invite your partner before proposing a date.');
      const result = await pool.query(`INSERT INTO date_proposals(id,couple_id,proposer_id,title,start_at,end_at)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING RETURNING *`, [id, coupleId, request.userId, input.title, input.start, input.end]);
      if (!result.rowCount) {
        const existing = await pool.query('SELECT * FROM date_proposals WHERE id=$1 AND couple_id=$2 AND proposer_id=$3', [id, coupleId, request.userId]);
        if (!existing.rowCount) throw new ApiError(409, 'Please start a new proposal.');
        return reply.send({ proposal: existing.rows[0] });
      }
      broadcast(realtime, coupleId, 'date_proposals', 'created', id);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'event', preference: 'notification_events', entityType: 'date_proposal', entityId: id, title: 'A little time together?', body: input.title }).catch((error) => request.log.error(error));
      return reply.code(201).send({ proposal: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/date-proposals/:id/respond', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const id = uuid((request.params as { id: string }).id);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const action = body.action;
      if (!['accept', 'decline', 'cancel', 'counter'].includes(String(action))) throw new ApiError(400, 'Choose a response.');
      await client.query('BEGIN');
      // Serialize agreements within a couple so two proposals cannot book the same time.
      await client.query('SELECT id FROM couples WHERE id=$1 FOR UPDATE', [coupleId]);
      const result = await client.query('SELECT * FROM date_proposals WHERE id=$1 AND couple_id=$2 FOR UPDATE', [id, coupleId]);
      const current = result.rows[0];
      if (!current) throw new ApiError(404, 'Proposal not found.');
      if (action !== 'cancel' && current.proposer_id === request.userId) throw new ApiError(403, 'Your partner needs to respond to this proposal.');
      if (action === 'cancel' && current.proposer_id !== request.userId) throw new ApiError(403, 'Only the proposer can cancel.');
      if (current.status === 'accepted' && action === 'accept') { await client.query('COMMIT'); return reply.send({ proposal: current }); }
      if (current.status !== 'pending' || body.revision !== current.revision) throw new ApiError(409, 'This proposal changed. Refresh and respond to the latest version.');
      let updated;
      if (action === 'accept') {
        if (new Date(current.start_at).getTime() <= Date.now()) throw new ApiError(409, 'This time has passed. Suggest a new time.');
        const conflict = await client.query(`SELECT id FROM events WHERE couple_id=$1 AND recurrence='none'
          AND start_at < $3 AND COALESCE(end_at,start_at + interval '30 minutes') > $2 LIMIT 1`, [coupleId, current.start_at, current.end_at]);
        if (conflict.rowCount) throw new ApiError(409, 'There is already a calendar event at this time. Please check your calendar and suggest another time.');
        const eventId = randomUUID();
        await client.query(`INSERT INTO events(id,couple_id,creator_id,title,start_at,end_at,assign_to_both,description,location,recurrence)
          VALUES($1,$2,$3,$4,$5,$6,true,'Planned together in Togetherly.','','none')`, [eventId, coupleId, current.proposer_id, current.title, current.start_at, current.end_at]);
        updated = await client.query("UPDATE date_proposals SET status='accepted',event_id=$1,revision=revision+1,updated_at=now() WHERE id=$2 RETURNING *", [eventId, id]);
      } else if (action === 'counter') {
        const input = planInput(body);
        updated = await client.query(`UPDATE date_proposals SET proposer_id=$1,title=$2,start_at=$3,end_at=$4,revision=revision+1,updated_at=now() WHERE id=$5 RETURNING *`, [request.userId, input.title, input.start, input.end, id]);
      } else {
        updated = await client.query('UPDATE date_proposals SET status=$1,revision=revision+1,updated_at=now() WHERE id=$2 RETURNING *', [action === 'decline' ? 'declined' : 'cancelled', id]);
      }
      await client.query('COMMIT');
      broadcast(realtime, coupleId, 'date_proposals', String(action), id);
      if (action === 'accept') broadcast(realtime, coupleId, 'events', 'created', updated.rows[0].event_id);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'event', preference: 'notification_events', entityType: 'date_proposal', entityId: id, title: action === 'accept' ? 'It’s a date ♥' : action === 'counter' ? 'How about this time?' : 'Date proposal updated', body: updated.rows[0].title }).catch((error) => request.log.error(error));
      return reply.send({ proposal: updated.rows[0] });
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); return sendError(reply, error); }
    finally { client.release(); }
  });

  app.get('/memories/:id/reflections', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const id = uuid((request.params as { id: string }).id);
      const result = await pool.query(`SELECT r.* FROM memory_reflections r JOIN memories m ON m.id=r.memory_id WHERE m.id=$1 AND m.couple_id=$2 ORDER BY r.updated_at`, [id, coupleId]);
      return reply.send({ reflections: result.rows });
    } catch (error) { return sendError(reply, error); }
  });
  app.put('/memories/:id/reflections', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const id = uuid((request.params as { id: string }).id);
      const body = requiredText((request.body as Record<string, unknown>)?.body, 'Your memory', 2000);
      const result = await pool.query(`INSERT INTO memory_reflections(memory_id,user_id,body)
        SELECT id,$2,$3 FROM memories WHERE id=$1 AND couple_id=$4
        ON CONFLICT(memory_id,user_id) DO UPDATE SET body=EXCLUDED.body,updated_at=now() RETURNING *`, [id, request.userId, body, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Memory not found.');
      broadcast(realtime, coupleId, 'memories', 'reflection', id);
      return reply.send({ reflection: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });
  app.get('/time-capsules', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(`SELECT ${capsuleProjection} FROM time_capsules WHERE couple_id=$1 ORDER BY opens_at DESC LIMIT 100`, [coupleId]);
      // No client cache: a previously opened capsule must never populate a sealed state.
      reply.header('Cache-Control', 'no-store');
      return reply.send({ capsules: result.rows });
    } catch (error) { return sendError(reply, error); }
  });
  app.post('/time-capsules', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = (request.body ?? {}) as Record<string, unknown>;
      const id = uuid(body.id);
      const title = requiredText(body.title, 'Title', 200);
      const text = optionalText(body.body, 5000);
      const photo = imageDataOrUrl(body.photoUrl);
      if (!text && !photo) throw new ApiError(400, 'Add a note or photo to seal.');
      const opens = dateTimeOrNull(body.opensAt, 'Opening time');
      if (!opens || Date.parse(opens) <= Date.now()) throw new ApiError(400, 'Choose a future opening time.');
      const result = await pool.query(`INSERT INTO time_capsules(id,couple_id,creator_id,title,body,photo_url,opens_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING id`, [id, coupleId, request.userId, title, text, photo, opens]);
      const safe = await pool.query(`SELECT ${capsuleProjection} FROM time_capsules WHERE id=$1 AND couple_id=$2 AND creator_id=$3`, [id, coupleId, request.userId]);
      if (!safe.rowCount) throw new ApiError(409, 'Please start a new capsule.');
      if (result.rowCount) {
        broadcast(realtime, coupleId, 'time_capsules', 'created', id);
        await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'time_capsule', entityId: id, title: 'Something to open together', body: title }).catch((error) => request.log.error(error));
      }
      return reply.code(result.rowCount ? 201 : 200).send({ capsule: safe.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });
  app.delete('/time-capsules/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const id = uuid((request.params as { id: string }).id);
      const result = await pool.query('DELETE FROM time_capsules WHERE id=$1 AND couple_id=$2 AND creator_id=$3 RETURNING id', [id, coupleId, request.userId]);
      if (!result.rowCount) throw new ApiError(404, 'Your capsule was not found.');
      broadcast(realtime, coupleId, 'time_capsules', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });
}
