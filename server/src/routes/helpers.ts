import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { ApiError } from '../utils/http.js';
import type { RealtimeHub } from '../realtime/hub.js';
import { afterCommit } from '../db/requestTransaction.js';
import { dispatchPush } from '../push/expo.js';

export async function requireCoupleId(userId: string) {
  const result = await pool.query('SELECT couple_id FROM couple_members WHERE user_id = $1', [userId]);
  const coupleId = result.rows[0]?.couple_id ? String(result.rows[0].couple_id) : null;
  if (!coupleId) throw new ApiError(403, 'This account is not linked to a couple.');
  return coupleId;
}

export function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new ApiError(400, `${label} is too long.`);
  return trimmed;
}

export function optionalText(value: unknown, maxLength: number) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new ApiError(400, 'Expected text.');
  if (value.length > maxLength) throw new ApiError(400, 'Text is too long.');
  return value.trim();
}

export function dateTimeOrNull(value: unknown, label: string) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, `${label} must be a date/time.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new ApiError(400, `${label} is not a valid date/time.`);
  return parsed.toISOString();
}

export function dateOnlyOrNull(value: unknown, label: string) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, `${label} must use YYYY-MM-DD.`);
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) throw new ApiError(400, `${label} is not valid.`);
  return value;
}

export function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}


export function imageDataOrUrl(value: unknown, label = 'Image') {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, `${label} is invalid.`);
  if (value.startsWith('data:')) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match) throw new ApiError(400, `${label} must be a JPEG, PNG or WebP image.`);
    const encoded = match[2];
    if (!encoded) throw new ApiError(400, `${label} image data is empty.`);
    const estimatedBytes = Math.floor(encoded.length * 0.75);
    if (estimatedBytes > 750_000) throw new ApiError(400, `${label} is too large. Choose a smaller image.`);
    return value;
  }
  if (value.length > 2000) throw new ApiError(400, `${label} URL is too long.`);
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new ApiError(400, `${label} must be an uploaded image or a valid web image URL.`);
  }
}

export function numberOrNull(value: unknown, label: string, min?: number, max?: number) {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new ApiError(400, `${label} must be a number.`);
  if (min != null && parsed < min) throw new ApiError(400, `${label} must be at least ${min}.`);
  if (max != null && parsed > max) throw new ApiError(400, `${label} must be no more than ${max}.`);
  return parsed;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

export function broadcast(realtime: RealtimeHub, coupleId: string, resource: string, action: string, id?: string) {
  realtime.broadcastCouple(coupleId, { type: 'feature.updated', resource, action, id });
}

export async function resolvePersonTarget(coupleId: string, userId: string, value: unknown) {
  const target = oneOf(value, ['me', 'partner', 'both'] as const, 'both');
  if (target === 'both') return { userId: null, both: true };
  if (target === 'me') return { userId, both: false };
  const result = await pool.query('SELECT user_id FROM couple_members WHERE couple_id = $1 AND user_id <> $2 LIMIT 1', [coupleId, userId]);
  if (!result.rows[0]?.user_id) throw new ApiError(400, 'Link your partner first.');
  return { userId: String(result.rows[0].user_id), both: false };
}

export async function validateTagIds(coupleId: string, tagIds: unknown) {
  if (tagIds === undefined) return undefined;
  if (!Array.isArray(tagIds) || tagIds.some((id) => typeof id !== 'string')) throw new ApiError(400, 'Tags are invalid.');
  const uniqueIds = [...new Set(tagIds as string[])].slice(0, 20);
  if (uniqueIds.length) {
    // Cast only after validating UUID syntax so PostgreSQL never turns malformed
    // client input into a 500-level uuid parsing error.
    if (uniqueIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      throw new ApiError(400, 'One or more tags are invalid.');
    }
    const valid = await pool.query('SELECT id FROM tags WHERE couple_id = $1 AND id = ANY($2::uuid[])', [coupleId, uniqueIds]);
    if ((valid.rowCount ?? 0) !== uniqueIds.length) throw new ApiError(400, 'One or more tags do not belong to this couple.');
  }
  return uniqueIds;
}

export async function setTags(coupleId: string, entityType: string, entityId: string, tagIds: unknown) {
  if (tagIds === undefined) return;
  const uniqueIds = await validateTagIds(coupleId, tagIds) ?? [];
  await pool.query('DELETE FROM content_tags WHERE entity_type = $1 AND entity_id = $2', [entityType, entityId]);
  for (const tagId of uniqueIds) {
    await pool.query('INSERT INTO content_tags(tag_id, entity_type, entity_id) VALUES($1, $2, $3) ON CONFLICT DO NOTHING', [tagId, entityType, entityId]);
  }
}

export function tagsSql(alias: string, entityType: string) {
  return `COALESCE((SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name, 'icon', tg.icon, 'icon_drawing', tg.icon_drawing) ORDER BY tg.name)
    FROM content_tags ct JOIN tags tg ON tg.id = ct.tag_id
    WHERE ct.entity_type = '${entityType}' AND ct.entity_id = ${alias}.id), '[]'::json) AS tags`;
}

export type NotificationPreference =
  | 'notification_partner_activity'
  | 'notification_tasks'
  | 'notification_events'
  | 'notification_countdowns'
  | 'notification_daily_question'
  | 'notification_partner_mood'
  | 'notification_goal_milestones'
  | 'notification_memories'
  | 'notification_visit_approaching'
  | 'notification_relationship_pings';

const notificationPreferenceColumns = new Set<NotificationPreference>([
  'notification_partner_activity',
  'notification_tasks',
  'notification_events',
  'notification_countdowns',
  'notification_daily_question',
  'notification_partner_mood',
  'notification_goal_milestones',
  'notification_memories',
  'notification_visit_approaching',
  'notification_relationship_pings',
]);

export async function notifyPartner(input: {
  coupleId: string;
  actorUserId: string;
  kind: 'partner_activity' | 'task' | 'event' | 'countdown' | 'daily_question' | 'mood' | 'goal' | 'memory' | 'visit' | 'love' | 'thinking_of_you';
  preference: NotificationPreference;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string | null;
}) {
  if (!notificationPreferenceColumns.has(input.preference)) throw new Error('Invalid notification preference column.');
  const result = await pool.query(
    `INSERT INTO notifications(id,couple_id,recipient_user_id,actor_user_id,kind,entity_type,entity_id,title,body)
     SELECT $8::uuid, cm.couple_id, cm.user_id, $2, $3, $4, $5::uuid, $6, $7
     FROM couple_members cm
     LEFT JOIN user_preferences up ON up.user_id = cm.user_id
     WHERE cm.couple_id = $1 AND cm.user_id <> $2 AND COALESCE(up.${input.preference}, true) = true
     RETURNING id,recipient_user_id,kind,entity_type,entity_id,title,body`,
    [input.coupleId, input.actorUserId, input.kind, input.entityType ?? null, input.entityId ?? null, input.title, input.body ?? '', randomUUID()],
  );
  for (const row of result.rows) afterCommit(() => { void dispatchPush(row); });
  return result.rows;
}
