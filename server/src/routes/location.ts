import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { authenticate } from '../auth/middleware.js';
import { pool } from '../db/pool.js';
import { ApiError, sendError } from '../utils/http.js';
import { isValidTimezone, requireCoupleId } from './helpers.js';

function finite(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : null; }

export async function registerLocationRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/location', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT u.id AS user_id,l.sharing_enabled,l.latitude,l.longitude,l.accuracy_m,l.captured_at,l.updated_at,u.display_name,cm.participant_color
         FROM couple_members cm JOIN users u ON u.id=cm.user_id
         LEFT JOIN live_locations l ON l.user_id=u.id
         WHERE cm.couple_id=$1 ORDER BY cm.joined_at ASC`, [coupleId]);
      return reply.send({ members: result.rows.map((row) => ({
        userId: String(row.user_id ?? ''), displayName: String(row.display_name), participantColor: row.participant_color,
        sharingEnabled: row.sharing_enabled === true,
        latitude: row.sharing_enabled && row.latitude != null ? Number(row.latitude) : null,
        longitude: row.sharing_enabled && row.longitude != null ? Number(row.longitude) : null,
        accuracyM: row.sharing_enabled && row.accuracy_m != null ? Number(row.accuracy_m) : null,
        capturedAt: row.sharing_enabled && row.captured_at ? new Date(row.captured_at).toISOString() : null,
      })) });
    } catch (error) { return sendError(reply, error); }
  });

  app.put('/location/sharing', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const enabled = (request.body as Record<string, unknown>)?.enabled === true;
      await pool.query(`INSERT INTO live_locations(user_id,couple_id,sharing_enabled) VALUES($1,$2,$3)
        ON CONFLICT(user_id) DO UPDATE SET couple_id=excluded.couple_id,sharing_enabled=excluded.sharing_enabled,updated_at=now()`, [request.userId,coupleId,enabled]);
      realtime.broadcastCouple(coupleId,{type:'feature.updated',resource:'location',action:enabled?'sharing_on':'sharing_off',id:request.userId});
      return reply.send({ ok:true, sharingEnabled:enabled });
    } catch (error) { return sendError(reply,error); }
  });

  app.put('/location/position', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const latitude = finite(body.latitude), longitude = finite(body.longitude), accuracyM = finite(body.accuracyM);
      if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new ApiError(400,'Location is invalid.');
      const capturedAt = typeof body.capturedAt === 'string' && Number.isFinite(new Date(body.capturedAt).getTime()) ? new Date(body.capturedAt).toISOString() : new Date().toISOString();
      const timezone = typeof body.timezone === 'string' && isValidTimezone(body.timezone) ? body.timezone : null;
      const existing = await pool.query('SELECT sharing_enabled FROM live_locations WHERE user_id=$1',[request.userId]);
      if (!existing.rows[0]?.sharing_enabled) throw new ApiError(409,'Location sharing is off.');
      await pool.query('UPDATE live_locations SET latitude=$1,longitude=$2,accuracy_m=$3,captured_at=$4,updated_at=now() WHERE user_id=$5',[latitude,longitude,accuracyM,capturedAt,request.userId]);
      if (timezone) await pool.query("UPDATE users SET timezone=$1,updated_at=now() WHERE id=$2 AND timezone_mode='automatic'",[timezone,request.userId]);
      realtime.broadcastCouple(coupleId,{type:'feature.updated',resource:'location',action:'position',id:request.userId});
      if (timezone) realtime.broadcastCouple(coupleId,{type:'workspace.updated'});
      return reply.send({ok:true});
    } catch (error) { return sendError(reply,error); }
  });
}
