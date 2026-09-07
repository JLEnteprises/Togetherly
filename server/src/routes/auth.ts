import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSession, createSessionWithClient, revokeRefreshToken, rotateRefreshToken, toPublicUser } from '../auth/session.js';
import { createOpaqueToken, hashOpaqueToken } from '../auth/tokens.js';
import { revokeWatchSessions } from '../auth/watch.js';
import { ApiError, sendError } from '../utils/http.js';
import { config } from '../config.js';
import { isValidTimezone } from './helpers.js';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `${label} is required.`);
  return value.trim();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

async function deliverPasswordReset(email: string, token: string) {
  if (!config.resendApiKey || !config.passwordResetFrom) return false;
  const separator = config.passwordResetLinkBase.includes('?') ? '&' : '?';
  const resetLink = `${config.passwordResetLinkBase}${separator}token=${encodeURIComponent(token)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.passwordResetFrom,
      to: [email],
      subject: 'Reset your Togetherly password',
      text: `Use this link within 30 minutes to reset your Togetherly password: ${resetLink}`,
      html: `<p>Use the link below within 30 minutes to reset your Togetherly password.</p><p><a href="${resetLink}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Password reset email delivery failed:', response.status, detail.slice(0, 500));
    return false;
  }
  return true;
}


async function clearLiveLocation(userId: string, realtime: RealtimeHub) {
  const result = await pool.query(
    'UPDATE live_locations SET sharing_enabled=false,latitude=NULL,longitude=NULL,accuracy_m=NULL,captured_at=NULL,updated_at=now() WHERE user_id=$1 RETURNING couple_id',
    [userId],
  );
  const coupleId = result.rows[0]?.couple_id ? String(result.rows[0].couple_id) : null;
  if (coupleId) realtime.broadcastCouple(coupleId, { type: 'feature.updated', resource: 'location', action: 'sharing_off', id: userId });
}

export async function registerAuthRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.post('/auth/register', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const email = normalizeEmail(requireString(body.email, 'Email'));
      const password = requireString(body.password, 'Password');
      const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'UTC';
      if (!validEmail(email)) throw new ApiError(400, 'Enter a valid email address.');
      if (!isValidTimezone(timezone)) throw new ApiError(400, 'Timezone must be a valid IANA timezone such as Australia/Brisbane.');
      if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');

      // Name and colour are deliberately collected in first-run onboarding, not on the login form.
      const displayName = typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim().slice(0, 80)
        : 'New member';

      const passwordHash = await hashPassword(password);
      const id = randomUUID();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO users(id, email, password_hash, display_name, timezone, onboarding_complete)
           VALUES($1, $2, $3, $4, $5, false)
           RETURNING *`,
          [id, email, passwordHash, displayName, timezone],
        );
        const tokens = await createSessionWithClient(client, id);
        await client.query('COMMIT');
        return reply.code(201).send({ user: toPublicUser(result.rows[0]), ...tokens });
      } catch (error) {
        await client.query('ROLLBACK');
        if ((error as { code?: string }).code === '23505') throw new ApiError(409, 'An account with that email already exists.');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/auth/login', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const email = normalizeEmail(requireString(body.email, 'Email'));
      const password = requireString(body.password, 'Password');
      const result = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL', [email]);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row || !(await verifyPassword(password, String(row.password_hash)))) {
        throw new ApiError(401, 'Email or password is incorrect.');
      }
      const tokens = await createSession(String(row.id));
      return reply.send({ user: toPublicUser(row), ...tokens });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const refreshToken = requireString(body.refreshToken, 'Refresh token');
      const rotated = await rotateRefreshToken(refreshToken);
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [rotated.userId]);
      if (!userResult.rows[0]) throw new ApiError(401, 'Account no longer exists.');
      return reply.send({ user: toPublicUser(userResult.rows[0]), ...rotated.tokens });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      if (typeof body.refreshToken === 'string' && body.refreshToken) {
        const userId = await revokeRefreshToken(body.refreshToken);
        if (userId) { await clearLiveLocation(userId, realtime); await revokeWatchSessions(userId); await pool.query('UPDATE device_push_tokens SET active=false,updated_at=now() WHERE user_id=$1', [userId]); }
      }
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [request.userId]);
      if (!result.rows[0]) throw new ApiError(404, 'Account not found.');
      return reply.send({ user: toPublicUser(result.rows[0]) });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/auth/export', { preHandler: authenticate }, async (request, reply) => {
    try {
      const profileResult = await pool.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL', [request.userId]);
      if (!profileResult.rows[0]) throw new ApiError(404, 'Account not found.');
      const membership = await pool.query('SELECT couple_id FROM couple_members WHERE user_id=$1', [request.userId]);
      const coupleId = membership.rows[0]?.couple_id ? String(membership.rows[0].couple_id) : null;
      const exportData: Record<string, unknown> = {
        exported_at: new Date().toISOString(),
        profile: toPublicUser(profileResult.rows[0]),
        couple: null,
        partner_profile: null,
        preferences: null,
        shared_items: [],
        tasks: [], task_subtasks: [], notes: [], lists: [], list_items: [], countdowns: [], events: [], goals: [], goal_contributions: [], trips: [], trip_links: [], memories: [], memory_media: [], memory_albums: [], memory_album_items: [], activities: [], schedules: [], tags: [],
        my_question_answers: [], my_moods: [], my_notifications: [],
      };
      const preferences = await pool.query('SELECT * FROM user_preferences WHERE user_id=$1', [request.userId]);
      exportData.preferences = preferences.rows[0] ?? null;
      if (!coupleId) return reply.send({ export: exportData });
      const couple = await pool.query('SELECT * FROM couples WHERE id=$1', [coupleId]);
      const partner = await pool.query(`SELECT u.id,u.display_name,u.avatar_url,u.timezone,u.created_at,u.updated_at
        FROM couple_members cm JOIN users u ON u.id=cm.user_id WHERE cm.couple_id=$1 AND cm.user_id<>$2 AND u.deleted_at IS NULL LIMIT 1`, [coupleId, request.userId]);
      exportData.couple = couple.rows[0] ?? null;
      exportData.partner_profile = partner.rows[0] ?? null;
      const queries: Array<[string, string, unknown[]]> = [
        ['shared_items', 'SELECT * FROM shared_items WHERE couple_id=$1 ORDER BY updated_at DESC', [coupleId]],
        ['tasks', 'SELECT * FROM tasks WHERE couple_id=$1 ORDER BY created_at DESC', [coupleId]],
        ['task_subtasks', 'SELECT st.* FROM task_subtasks st JOIN tasks t ON t.id=st.task_id WHERE t.couple_id=$1 ORDER BY st.created_at', [coupleId]],
        ['notes', "SELECT * FROM notes WHERE couple_id=$1 AND (visibility='shared' OR creator_id=$2) ORDER BY updated_at DESC", [coupleId, request.userId]],
        ['lists', 'SELECT * FROM lists WHERE couple_id=$1 ORDER BY created_at DESC', [coupleId]],
        ['list_items', 'SELECT li.* FROM list_items li JOIN lists l ON l.id=li.list_id WHERE l.couple_id=$1 ORDER BY li.created_at DESC', [coupleId]],
        ['countdowns', 'SELECT * FROM countdowns WHERE couple_id=$1 ORDER BY target_at', [coupleId]],
        ['events', 'SELECT * FROM events WHERE couple_id=$1 ORDER BY start_at', [coupleId]],
        ['goals', 'SELECT * FROM goals WHERE couple_id=$1 ORDER BY created_at DESC', [coupleId]],
        ['goal_contributions', 'SELECT gc.* FROM goal_contributions gc JOIN goals g ON g.id=gc.goal_id WHERE g.couple_id=$1 ORDER BY gc.created_at DESC', [coupleId]],
        ['trips', 'SELECT * FROM trips WHERE couple_id=$1 ORDER BY start_date', [coupleId]],
        ['trip_links', 'SELECT tl.* FROM trip_links tl JOIN trips tr ON tr.id=tl.trip_id WHERE tr.couple_id=$1 ORDER BY tl.created_at', [coupleId]],
        ['memories', 'SELECT * FROM memories WHERE couple_id=$1 ORDER BY memory_date DESC', [coupleId]],
        ['memory_media', 'SELECT mm.* FROM memory_media mm JOIN memories m ON m.id=mm.memory_id WHERE m.couple_id=$1 ORDER BY mm.created_at', [coupleId]],
        ['memory_albums', 'SELECT * FROM memory_albums WHERE couple_id=$1 ORDER BY created_at', [coupleId]],
        ['memory_album_items', 'SELECT mai.* FROM memory_album_items mai JOIN memory_albums ma ON ma.id=mai.album_id WHERE ma.couple_id=$1 ORDER BY mai.created_at', [coupleId]],
        ['activities', 'SELECT * FROM activities WHERE couple_id=$1 ORDER BY created_at DESC', [coupleId]],
        ['schedules', 'SELECT * FROM user_schedules WHERE couple_id=$1 ORDER BY user_id,day_of_week,start_minute', [coupleId]],
        ['tags', 'SELECT * FROM tags WHERE couple_id=$1 ORDER BY name', [coupleId]],
        ['my_question_answers', 'SELECT * FROM question_answers WHERE couple_id=$1 AND user_id=$2 ORDER BY answer_date DESC', [coupleId, request.userId]],
        ['my_moods', 'SELECT * FROM moods WHERE couple_id=$1 AND user_id=$2 ORDER BY created_at DESC', [coupleId, request.userId]],
        ['my_notifications', 'SELECT * FROM notifications WHERE couple_id=$1 AND recipient_user_id=$2 ORDER BY created_at DESC', [coupleId, request.userId]],
      ];
      for (const [key, sql, params] of queries) exportData[key] = (await pool.query(sql, params)).rows;
      return reply.send({ export: exportData });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/auth/email', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const nextEmail = normalizeEmail(requireString(body.email, 'Email'));
      const password = requireString(body.currentPassword, 'Current password');
      if (!validEmail(nextEmail)) throw new ApiError(400, 'Enter a valid email address.');
      const current = await pool.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL', [request.userId]);
      if (!current.rows[0] || !(await verifyPassword(password, String(current.rows[0].password_hash)))) throw new ApiError(401, 'Current password is incorrect.');
      try {
        const result = await pool.query('UPDATE users SET email=$1,updated_at=now() WHERE id=$2 RETURNING *', [nextEmail, request.userId]);
        await pool.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [request.userId]);
        return reply.send({ user: toPublicUser(result.rows[0]) });
      } catch (error) {
        if ((error as { code?: string }).code === '23505') throw new ApiError(409, 'That email address is already in use.');
        throw error;
      }
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/auth/change-password', { preHandler: authenticate }, async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const currentPassword = requireString(body.currentPassword, 'Current password');
      const newPassword = requireString(body.newPassword, 'New password');
      if (newPassword.length < 8) throw new ApiError(400, 'New password must be at least 8 characters.');
      const result = await pool.query('SELECT password_hash FROM users WHERE id=$1 AND deleted_at IS NULL', [request.userId]);
      if (!result.rows[0] || !(await verifyPassword(currentPassword, String(result.rows[0].password_hash)))) throw new ApiError(401, 'Current password is incorrect.');
      await pool.query('UPDATE users SET password_hash=$1,auth_version=auth_version+1,updated_at=now() WHERE id=$2', [await hashPassword(newPassword), request.userId]);
      await pool.query('UPDATE sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1', [request.userId]);
      await revokeWatchSessions(request.userId);
      await pool.query('UPDATE device_push_tokens SET active=false,updated_at=now() WHERE user_id=$1', [request.userId]);
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [request.userId]);
      await clearLiveLocation(request.userId, realtime);
      return reply.send({ ok: true });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/auth/sign-out-all', { preHandler: authenticate }, async (request, reply) => {
    try {
      await pool.query('UPDATE users SET auth_version=auth_version+1,updated_at=now() WHERE id=$1 AND deleted_at IS NULL', [request.userId]);
      await pool.query('UPDATE sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1', [request.userId]);
      await revokeWatchSessions(request.userId);
      await pool.query('UPDATE device_push_tokens SET active=false,updated_at=now() WHERE user_id=$1', [request.userId]);
      await clearLiveLocation(request.userId, realtime);
      return reply.send({ ok: true });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/auth/account', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const body = request.body as Record<string, unknown>;
      const password = requireString(body.password, 'Password');
      await client.query('BEGIN');
      const userResult = await client.query('SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [request.userId]);
      const user = userResult.rows[0];
      if (!user || !(await verifyPassword(password, String(user.password_hash)))) throw new ApiError(401, 'Password is incorrect.');

      const membership = await client.query('SELECT couple_id FROM couple_members WHERE user_id=$1 FOR UPDATE', [request.userId]);
      const coupleId = membership.rows[0]?.couple_id ? String(membership.rows[0].couple_id) : null;
      if (coupleId) {
        const members = await client.query('SELECT user_id FROM couple_members WHERE couple_id=$1 ORDER BY joined_at ASC', [coupleId]);
        const partner = members.rows.find((row) => String(row.user_id) !== request.userId);
        if (!partner) {
          await client.query('DELETE FROM couples WHERE id=$1', [coupleId]);
        } else {
          const partnerId = String(partner.user_id);
          // Private data is removed. Shared records remain with "Deleted account" attribution.
          await client.query("DELETE FROM notes WHERE couple_id=$1 AND creator_id=$2 AND visibility='private'", [coupleId, request.userId]);
          await client.query('DELETE FROM moods WHERE user_id=$1', [request.userId]);
          await client.query('DELETE FROM question_answers WHERE user_id=$1', [request.userId]);
          await client.query('DELETE FROM activity_interests WHERE user_id=$1', [request.userId]);
          await client.query('UPDATE tasks SET assignee_id=NULL,assign_to_both=true,updated_at=now() WHERE couple_id=$1 AND assignee_id=$2', [coupleId, request.userId]);
          await client.query('UPDATE events SET assigned_user_id=NULL,assign_to_both=true,updated_at=now() WHERE couple_id=$1 AND assigned_user_id=$2', [coupleId, request.userId]);
          await client.query('UPDATE couples SET owner_user_id=$1,updated_at=now() WHERE id=$2 AND owner_user_id=$3', [partnerId, coupleId, request.userId]);
          await client.query('DELETE FROM couple_members WHERE couple_id=$1 AND user_id=$2', [coupleId, request.userId]);
        }
      }

      const tombstoneEmail = `deleted+${request.userId}@togetherly.invalid`;
      const tombstonePassword = await hashPassword(`${randomUUID()}-${randomUUID()}`);
      await client.query(
        `UPDATE users SET email=$1,password_hash=$2,display_name='Deleted account',avatar_url=NULL,preferred_participant_color=NULL,
         onboarding_complete=false,deleted_at=now(),auth_version=auth_version+1,updated_at=now() WHERE id=$3`,
        [tombstoneEmail, tombstonePassword, request.userId],
      );
      await client.query('UPDATE sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1', [request.userId]);
      await client.query('UPDATE watch_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1', [request.userId]);
      await client.query('UPDATE device_push_tokens SET active=false,updated_at=now() WHERE user_id=$1', [request.userId]);
      await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [request.userId]);
      await client.query('DELETE FROM notifications WHERE recipient_user_id=$1', [request.userId]);
      await client.query('UPDATE live_locations SET sharing_enabled=false,latitude=NULL,longitude=NULL,accuracy_m=NULL,captured_at=NULL,updated_at=now() WHERE user_id=$1', [request.userId]);
      await client.query('DELETE FROM user_preferences WHERE user_id=$1', [request.userId]);
      await client.query('COMMIT');
      if (coupleId) {
        realtime.broadcastCouple(coupleId, { type: 'feature.updated', resource: 'location', action: 'sharing_off', id: request.userId });
        realtime.broadcastCouple(coupleId, { type: 'workspace.updated' });
      }
      return reply.code(204).send();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.post('/auth/password-reset/request', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const email = normalizeEmail(requireString(body.email, 'Email'));
      const result = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL', [email]);
      const row = result.rows[0] as { id: string } | undefined;
      if (!row) return reply.send({ ok: true });

      const token = createOpaqueToken();
      const expiresAt = new Date(Date.now() + 30 * 60_000);
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at <= now() OR used_at IS NOT NULL', [row.id]);
      await pool.query(
        'INSERT INTO password_reset_tokens(id, user_id, token_hash, expires_at) VALUES($1, $2, $3, $4)',
        [randomUUID(), row.id, token.hash, expiresAt],
      );
      await deliverPasswordReset(email, token.token);
      // Keep the production response indistinguishable for known and unknown emails.
      // Development may optionally return the token so local testing can complete without mail delivery.
      return reply.send({ ok: true, developmentToken: config.returnDevelopmentResetToken ? token.token : undefined });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/auth/password-reset/confirm', async (request, reply) => {
    const client = await pool.connect();
    try {
      const body = request.body as Record<string, unknown>;
      const token = requireString(body.token, 'Reset token');
      const password = requireString(body.password, 'New password');
      if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
      await client.query('BEGIN');
      const result = await client.query(
        `SELECT prt.id, prt.user_id FROM password_reset_tokens prt
         JOIN users u ON u.id=prt.user_id
         WHERE prt.token_hash = $1 AND prt.used_at IS NULL AND prt.expires_at > now() AND u.deleted_at IS NULL
         FOR UPDATE`,
        [hashOpaqueToken(token)],
      );
      const row = result.rows[0] as { id: string; user_id: string } | undefined;
      if (!row) throw new ApiError(400, 'That reset link is invalid or has expired.');
      await client.query('UPDATE users SET password_hash = $1, auth_version = auth_version + 1, updated_at = now() WHERE id = $2', [await hashPassword(password), row.user_id]);
      await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [row.id]);
      await client.query('UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE user_id = $1', [row.user_id]);
      await revokeWatchSessions(String(row.user_id));
      await client.query('UPDATE device_push_tokens SET active=false,updated_at=now() WHERE user_id=$1', [String(row.user_id)]);
      await client.query('UPDATE live_locations SET sharing_enabled=false,latitude=NULL,longitude=NULL,accuracy_m=NULL,captured_at=NULL,updated_at=now() WHERE user_id=$1', [row.user_id]);
      await client.query('COMMIT');
      await clearLiveLocation(String(row.user_id), realtime);
      return reply.send({ ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      return sendError(reply, error);
    } finally {
      client.release();
    }
  });
}
