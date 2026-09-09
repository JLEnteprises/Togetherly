import { pool } from '../db/pool.js';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export type PushNotificationRecord = {
  id: string;
  recipient_user_id: string;
  kind: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string;
};

function hrefFor(entityType: string | null, entityId: string | null) {
  if (!entityType) return null;
  if (entityType === 'date_proposal') return '/features/date-plans';
  if (entityType === 'time_capsule') return '/features/time-capsules';
  if (entityType === 'question') return '/features/daily-question';
  if (entityType === 'mood') return '/features/mood';
  if (entityType === 'relationship_ping') return '/(tabs)/together';
  const routes: Record<string, string> = {
    task: '/features/tasks', note: '/features/notes', list: '/features/lists', event: '/features/calendar',
    goal: '/features/goals', memory: '/features/memories', activity: '/features/activities', trip: '/features/trips', countdown: '/features/countdowns',
  };
  const base = routes[entityType];
  if (!base || !entityId) return null;
  if (entityType === 'trip') return `/features/trip-detail?id=${encodeURIComponent(entityId)}`;
  return `${base}?focus=${encodeURIComponent(entityId)}`;
}

async function deactivateTokens(tokens: string[]) {
  if (!tokens.length) return;
  await pool.query('UPDATE device_push_tokens SET active=false,updated_at=now() WHERE token = ANY($1::text[])', [tokens]);
}

export async function sendPushForNotification(notification: PushNotificationRecord) {
  const result = await pool.query(
    `SELECT token FROM device_push_tokens
     WHERE user_id=$1 AND active=true AND last_seen_at >= now() - interval '120 days'`,
    [notification.recipient_user_id],
  );
  const tokens = result.rows.map((row) => String(row.token)).filter((token) => TOKEN_RE.test(token));
  if (!tokens.length) return { attempted: 0 };

  const href = hrefFor(notification.entity_type, notification.entity_id);
  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body || undefined,
    channelId: notification.kind === 'love' || notification.kind === 'thinking_of_you' || notification.kind === 'mood' || notification.kind === 'daily_question' ? 'relationship' : ['task','event','countdown','goal','visit'].includes(notification.kind) ? 'planning' : 'general',
    priority: 'high',
    data: {
      notificationId: notification.id,
      kind: notification.kind,
      entityType: notification.entity_type,
      entityId: notification.entity_id,
      href,
    },
  }));

  try {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      console.warn('Expo push request failed:', response.status, await response.text().catch(() => ''));
      return { attempted: tokens.length, delivered: 0 };
    }
    const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    const invalid: string[] = [];
    payload.data?.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const token = tokens[index];
        if (token) invalid.push(token);
      }
    });
    await deactivateTokens(invalid);
    return { attempted: tokens.length, delivered: tokens.length - invalid.length };
  } catch (error) {
    console.warn('Expo push delivery failed:', error instanceof Error ? error.message : error);
    return { attempted: tokens.length, delivered: 0 };
  }
}

export function dispatchPush(notification: PushNotificationRecord | null | undefined) {
  if (!notification) return;
  void sendPushForNotification(notification).catch((error) => console.warn('Push dispatch failed:', error));
}
