import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { ApiError } from '../utils/http.js';
import { createOpaqueToken, hashOpaqueToken, issueAccessToken } from './tokens.js';

export type PublicUser = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  timezone_mode: 'automatic' | 'manual';
  onboarding_complete: boolean;
  preferred_participant_color: 'purple' | 'green' | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toPublicUser(row: Record<string, unknown>): PublicUser {
  return {
    id: String(row.id),
    email: String(row.email),
    display_name: String(row.display_name),
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    timezone: String(row.timezone),
    timezone_mode: row.timezone_mode === 'manual' ? 'manual' : 'automatic',
    onboarding_complete: row.onboarding_complete === true,
    preferred_participant_color: row.preferred_participant_color === 'green' ? 'green' : row.preferred_participant_color === 'purple' ? 'purple' : null,
    deleted_at: row.deleted_at ? new Date(String(row.deleted_at)).toISOString() : null,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function createSessionWithClient(client: PoolClient, userId: string) {
  const refresh = createOpaqueToken();
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 86_400_000);
  await client.query(
    'INSERT INTO sessions(id, user_id, refresh_token_hash, expires_at) VALUES($1, $2, $3, $4)',
    [randomUUID(), userId, refresh.hash, expiresAt],
  );
  const versionResult = await client.query('SELECT auth_version FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
  const authVersion = Number(versionResult.rows[0]?.auth_version ?? 0);
  if (!Number.isInteger(authVersion) || authVersion < 1) throw new ApiError(401, 'Account no longer exists.');
  const access = issueAccessToken(userId, authVersion);
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: expiresAt.toISOString(),
  };
}

export async function createSession(userId: string) {
  const client = await pool.connect();
  try {
    return await createSessionWithClient(client, userId);
  } finally {
    client.release();
  }
}

export async function rotateRefreshToken(refreshToken: string) {
  const hash = hashOpaqueToken(refreshToken);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM sessions
       WHERE refresh_token_hash = $1
       FOR UPDATE`,
      [hash],
    );
    const row = result.rows[0] as { id: string; user_id: string; expires_at: Date; revoked_at: Date | null } | undefined;
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
      throw new ApiError(401, 'Refresh session is no longer valid.');
    }
    await client.query('UPDATE sessions SET revoked_at = now() WHERE id = $1', [row.id]);
    const tokens = await createSessionWithClient(client, row.user_id);
    await client.query('COMMIT');
    return { userId: row.user_id, tokens };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeRefreshToken(refreshToken: string) {
  const result = await pool.query(
    'UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE refresh_token_hash = $1 RETURNING user_id',
    [hashOpaqueToken(refreshToken)],
  );
  return result.rows[0]?.user_id ? String(result.rows[0].user_id) : null;
}
