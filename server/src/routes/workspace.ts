import { randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { dateOnlyOrNull, imageDataOrUrl, isValidTimezone, oneOf } from './helpers.js';
import { toPublicUser } from '../auth/session.js';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
type ParticipantColor = 'purple' | 'green';
const opposite = (color: ParticipantColor): ParticipantColor => color === 'purple' ? 'green' : 'purple';

function toPartnerProfile(row: Record<string, unknown>) {
  return { ...toPublicUser(row), email: '' };
}

function inviteCode() {
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte: number) => alphabet[byte % alphabet.length]).join('');
}

async function currentCoupleId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT couple_id FROM couple_members WHERE user_id = $1', [userId]);
  return result.rows[0]?.couple_id ? String(result.rows[0].couple_id) : null;
}

async function cleanupMemberDeparture(client: PoolClient, coupleId: string, userId: string, partnerId: string) {
  await client.query("DELETE FROM notes WHERE couple_id=$1 AND creator_id=$2 AND visibility='private'", [coupleId, userId]);
  await client.query('DELETE FROM moods WHERE couple_id=$1 AND user_id=$2', [coupleId, userId]);
  await client.query('DELETE FROM question_answers WHERE couple_id=$1 AND user_id=$2', [coupleId, userId]);
  await client.query('DELETE FROM activity_interests WHERE user_id=$1 AND activity_id IN (SELECT id FROM activities WHERE couple_id=$2)', [userId, coupleId]);
  await client.query('DELETE FROM notifications WHERE couple_id=$1 AND recipient_user_id=$2', [coupleId, userId]);
  await client.query('DELETE FROM user_schedules WHERE couple_id=$1 AND user_id=$2', [coupleId, userId]);
  await client.query('UPDATE tasks SET assignee_id=NULL,assign_to_both=true,updated_at=now() WHERE couple_id=$1 AND assignee_id=$2', [coupleId, userId]);
  await client.query('UPDATE events SET assigned_user_id=NULL,assign_to_both=true,updated_at=now() WHERE couple_id=$1 AND assigned_user_id=$2', [coupleId, userId]);
  await client.query('UPDATE couples SET owner_user_id=$1,updated_at=now() WHERE id=$2 AND owner_user_id=$3', [partnerId, coupleId, userId]);
  await client.query('DELETE FROM couple_members WHERE couple_id=$1 AND user_id=$2', [coupleId, userId]);
  await client.query('UPDATE couple_invites SET expires_at=now() WHERE couple_id=$1 AND accepted_at IS NULL', [coupleId]);
}

async function generateInvite(client: PoolClient, coupleId: string, userId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = inviteCode();
    const inserted = await client.query(
      `INSERT INTO couple_invites(id, couple_id, invite_code, created_by, expires_at)
       VALUES($1, $2, $3, $4, now() + interval '30 days')
       ON CONFLICT (invite_code) DO NOTHING
       RETURNING invite_code`,
      [randomUUID(), coupleId, candidate, userId],
    );
    if (inserted.rowCount) return candidate;
  }
  throw new ApiError(500, 'Could not generate a unique invite code.');
}

export async function registerWorkspaceRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/workspace', { preHandler: authenticate }, async (request, reply) => {
    try {
      const profileResult = await pool.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [request.userId]);
      if (!profileResult.rows[0]) throw new ApiError(404, 'Profile not found.');
      const profile = toPublicUser(profileResult.rows[0]);
      const coupleId = await currentCoupleId(request.userId);
      if (!coupleId) return reply.send({ profile, couple: null, activeInvite: null, memberCount: 0, partnerProfile: null, myColor: null, partnerColor: null });

      const [coupleResult, membersResult, inviteResult] = await Promise.all([
        pool.query('SELECT * FROM couples WHERE id = $1', [coupleId]),
        pool.query(
          `SELECT u.*, cm.participant_color FROM couple_members cm
           JOIN users u ON u.id = cm.user_id
           WHERE cm.couple_id = $1 AND u.deleted_at IS NULL
           ORDER BY cm.joined_at ASC, cm.user_id ASC`,
          [coupleId],
        ),
        pool.query(
          `SELECT * FROM couple_invites
           WHERE couple_id = $1 AND accepted_at IS NULL AND expires_at > now()
           ORDER BY created_at DESC LIMIT 1`,
          [coupleId],
        ),
      ]);
      const partnerRow = membersResult.rows.find((row) => String(row.id) !== request.userId);
      const currentRow = membersResult.rows.find((row) => String(row.id) === request.userId);
      const myColor: ParticipantColor = currentRow?.participant_color === 'green' ? 'green' : 'purple';
      const partnerColor: ParticipantColor = partnerRow?.participant_color === 'purple' ? 'purple' : partnerRow?.participant_color === 'green' ? 'green' : opposite(myColor);
      return reply.send({
        profile,
        couple: coupleResult.rows[0] ?? null,
        activeInvite: inviteResult.rows[0] ?? null,
        memberCount: membersResult.rowCount ?? 0,
        partnerProfile: partnerRow ? toPartnerProfile(partnerRow) : null,
        myColor,
        partnerColor,
      });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/workspace/create', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const body = request.body as Record<string, unknown>;
      const relationshipStartDate = dateOnlyOrNull(body.relationshipStartDate, 'Relationship start date');
      const longDistanceEnabled = body.longDistanceEnabled !== false;
      await client.query('BEGIN');
      const existing = await client.query('SELECT couple_id FROM couple_members WHERE user_id = $1 FOR UPDATE', [request.userId]);
      if (existing.rowCount) throw new ApiError(409, 'This account is already linked to a couple.');
      const profile = await client.query('SELECT preferred_participant_color FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [request.userId]);
      if (!profile.rows[0]) throw new ApiError(404, 'Profile not found.');
      const requested = oneOf(body.participantColor, ['purple', 'green'] as const,
        profile.rows[0].preferred_participant_color === 'green' ? 'green' : 'purple');

      const coupleId = randomUUID();
      await client.query(
        'INSERT INTO couples(id, relationship_start_date, long_distance_enabled, owner_user_id) VALUES($1, $2, $3, $4)',
        [coupleId, relationshipStartDate, longDistanceEnabled, request.userId],
      );
      await client.query('INSERT INTO couple_members(couple_id, user_id, participant_color) VALUES($1, $2, $3)', [coupleId, request.userId, requested]);
      await client.query('UPDATE users SET preferred_participant_color=$1,updated_at=now() WHERE id=$2', [requested, request.userId]);
      const code = await generateInvite(client, coupleId, request.userId);
      await client.query('COMMIT');
      realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      return reply.code(201).send({ coupleId, inviteCode: code, participantColor: requested });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.post('/workspace/join', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const body = request.body as Record<string, unknown>;
      const code = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '';
      if (!/^[A-Z0-9]{8}$/.test(code)) throw new ApiError(400, 'Enter a valid 8-character invite code.');
      await client.query('BEGIN');
      const existing = await client.query('SELECT couple_id FROM couple_members WHERE user_id = $1 FOR UPDATE', [request.userId]);
      if (existing.rowCount) throw new ApiError(409, 'This account is already linked to a couple.');
      const inviteResult = await client.query('SELECT * FROM couple_invites WHERE invite_code = $1 FOR UPDATE', [code]);
      const invite = inviteResult.rows[0] as { id: string; couple_id: string; created_by: string; expires_at: Date; accepted_at: Date | null } | undefined;
      if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) throw new ApiError(404, 'That invite code is invalid or has expired.');
      if (invite.created_by === request.userId) throw new ApiError(400, 'You cannot join your own invite.');
      const members = await client.query('SELECT user_id,participant_color FROM couple_members WHERE couple_id=$1 ORDER BY joined_at ASC FOR UPDATE', [invite.couple_id]);
      if ((members.rowCount ?? 0) >= 2) throw new ApiError(409, 'That couple space already has two members.');
      const taken: ParticipantColor = members.rows[0]?.participant_color === 'green' ? 'green' : 'purple';
      const assigned = opposite(taken);
      await client.query('INSERT INTO couple_members(couple_id, user_id, participant_color) VALUES($1, $2, $3)', [invite.couple_id, request.userId, assigned]);
      await client.query('UPDATE users SET preferred_participant_color=$1,updated_at=now() WHERE id=$2', [assigned, request.userId]);
      await client.query('UPDATE couple_invites SET accepted_at = now(), accepted_by = $1 WHERE id = $2', [request.userId, invite.id]);
      await client.query('COMMIT');
      realtime.broadcastCouple(invite.couple_id, { type: 'workspace.updated' });
      return reply.send({ coupleId: invite.couple_id, participantColor: assigned });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.post('/workspace/invite/regenerate', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const membership = await client.query('SELECT couple_id FROM couple_members WHERE user_id = $1', [request.userId]);
      const coupleId = membership.rows[0]?.couple_id ? String(membership.rows[0].couple_id) : null;
      if (!coupleId) throw new ApiError(404, 'Create a couple space first.');
      const count = await client.query('SELECT count(*)::int AS count FROM couple_members WHERE couple_id = $1', [coupleId]);
      if (Number(count.rows[0]?.count ?? 0) >= 2) throw new ApiError(409, 'Your partner is already linked.');
      await client.query('UPDATE couple_invites SET expires_at = now() WHERE couple_id = $1 AND accepted_at IS NULL', [coupleId]);
      const code = await generateInvite(client, coupleId, request.userId);
      await client.query('COMMIT');
      realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      return reply.send({ inviteCode: code });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.patch('/workspace/profile', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const body = request.body as Record<string, unknown>;
      await client.query('BEGIN');
      const currentResult = await client.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [request.userId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Profile not found.');
      const displayName = body.displayName === undefined ? String(current.display_name) : typeof body.displayName === 'string' && body.displayName.trim().length > 0 && body.displayName.trim().length <= 80 ? body.displayName.trim() : null;
      if (!displayName) throw new ApiError(400, 'Display name must be between 1 and 80 characters.');
      const timezoneMode = body.timezoneMode === undefined ? (current.timezone_mode === 'manual' ? 'manual' : 'automatic') : body.timezoneMode === 'manual' ? 'manual' : 'automatic';
      const timezone = body.timezone === undefined ? String(current.timezone) : typeof body.timezone === 'string' && body.timezone.trim().length > 0 && body.timezone.length <= 120 ? body.timezone.trim() : null;
      if (!timezone || !isValidTimezone(timezone)) throw new ApiError(400, 'Timezone must be a valid timezone such as Australia/Brisbane.');
      const avatarUrl = body.avatarUrl === undefined ? current.avatar_url : imageDataOrUrl(body.avatarUrl, 'Profile photo');
      const preferredColor = body.preferredColor === undefined
        ? (current.preferred_participant_color === 'green' ? 'green' : current.preferred_participant_color === 'purple' ? 'purple' : null)
        : oneOf(body.preferredColor, ['purple', 'green'] as const, 'purple');
      const onboardingComplete = body.onboardingComplete === undefined ? current.onboarding_complete === true : body.onboardingComplete === true;

      const membership = await client.query('SELECT couple_id,participant_color FROM couple_members WHERE user_id=$1 FOR UPDATE', [request.userId]);
      if (membership.rows[0] && preferredColor && preferredColor !== membership.rows[0].participant_color) {
        const count = await client.query('SELECT count(*)::int AS count FROM couple_members WHERE couple_id=$1', [membership.rows[0].couple_id]);
        if (Number(count.rows[0]?.count ?? 0) > 1) throw new ApiError(409, 'Both colours are already in use. Use “Swap our colours” to change them together.');
        await client.query('UPDATE couple_members SET participant_color=$1 WHERE user_id=$2', [preferredColor, request.userId]);
      }
      const result = await client.query(
        `UPDATE users SET display_name=$1,timezone=$2,avatar_url=$3,preferred_participant_color=$4,onboarding_complete=$5,timezone_mode=$6,updated_at=now()
         WHERE id=$7 RETURNING *`,
        [displayName, timezone, avatarUrl, preferredColor, onboardingComplete, timezoneMode, request.userId],
      );
      await client.query('COMMIT');
      const coupleId = membership.rows[0]?.couple_id ? String(membership.rows[0].couple_id) : null;
      if (coupleId) realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      return reply.send({ profile: toPublicUser(result.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.patch('/workspace/couple', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await currentCoupleId(request.userId);
      if (!coupleId) throw new ApiError(404, 'Create a couple space first.');
      const current = await pool.query('SELECT * FROM couples WHERE id = $1', [coupleId]);
      if (!current.rows[0]) throw new ApiError(404, 'Couple space not found.');
      const body = request.body as Record<string, unknown>;
      const relationshipStartDate = body.relationshipStartDate === undefined ? current.rows[0].relationship_start_date : dateOnlyOrNull(body.relationshipStartDate, 'Relationship start date');
      const longDistanceEnabled = body.longDistanceEnabled === undefined ? Boolean(current.rows[0].long_distance_enabled) : body.longDistanceEnabled === true;
      const result = await pool.query(
        `UPDATE couples SET relationship_start_date = $1, long_distance_enabled = $2, updated_at = now()
         WHERE id = $3 RETURNING *`,
        [relationshipStartDate, longDistanceEnabled, coupleId],
      );
      realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      return reply.send({ couple: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/workspace/leave', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const membership = await client.query('SELECT couple_id FROM couple_members WHERE user_id=$1 FOR UPDATE', [request.userId]);
      const coupleId = membership.rows[0]?.couple_id ? String(membership.rows[0].couple_id) : null;
      if (!coupleId) throw new ApiError(404, 'This account is not linked to a couple.');
      const members = await client.query('SELECT user_id FROM couple_members WHERE couple_id=$1 ORDER BY joined_at ASC FOR UPDATE', [coupleId]);
      const partner = members.rows.find((row) => String(row.user_id) !== request.userId);
      if (!partner) await client.query('DELETE FROM couples WHERE id=$1', [coupleId]);
      else await cleanupMemberDeparture(client, coupleId, request.userId, String(partner.user_id));
      await client.query('COMMIT');
      realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      return reply.send({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.post('/workspace/remove-partner', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const membership = await client.query('SELECT cm.couple_id,c.owner_user_id FROM couple_members cm JOIN couples c ON c.id=cm.couple_id WHERE cm.user_id=$1 FOR UPDATE', [request.userId]);
      const row = membership.rows[0];
      if (!row) throw new ApiError(404, 'This account is not linked to a couple.');
      if (String(row.owner_user_id) !== request.userId) throw new ApiError(403, 'Only the person who created this couple space can unlink the other account.');
      const partner = await client.query('SELECT user_id FROM couple_members WHERE couple_id=$1 AND user_id<>$2 FOR UPDATE', [row.couple_id, request.userId]);
      if (!partner.rows[0]) throw new ApiError(404, 'No linked partner found.');
      await cleanupMemberDeparture(client, String(row.couple_id), String(partner.rows[0].user_id), request.userId);
      await client.query('COMMIT');
      realtime.broadcastCouple(String(row.couple_id), { type: 'workspace.updated' });
      return reply.send({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.delete('/workspace', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const membership = await client.query('SELECT cm.couple_id,c.owner_user_id FROM couple_members cm JOIN couples c ON c.id=cm.couple_id WHERE cm.user_id=$1 FOR UPDATE', [request.userId]);
      const row = membership.rows[0];
      if (!row) throw new ApiError(404, 'This account is not linked to a couple.');
      if (String(row.owner_user_id) !== request.userId) throw new ApiError(403, 'Only the person who created this couple space can delete it.');
      const coupleId = String(row.couple_id);
      await client.query('DELETE FROM couples WHERE id=$1', [coupleId]);
      await client.query('COMMIT');
      realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      return reply.code(204).send();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });
}
