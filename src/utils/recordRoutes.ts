import type { SearchResult } from '@/types/database';

const featureRoutes: Record<SearchResult['type'], string> = {
  task: '/features/tasks',
  note: '/features/notes',
  list: '/features/lists',
  event: '/features/calendar',
  goal: '/features/goals',
  memory: '/features/memories',
  activity: '/features/activities',
  trip: '/features/trips',
  countdown: '/features/countdowns',
};

export function recordHref(type: SearchResult['type'], id: string) {
  if (type === 'list') return `/features/lists/${encodeURIComponent(id)}`;
  if (type === 'trip') return `/features/trip-detail?id=${encodeURIComponent(id)}`;
  return `${featureRoutes[type]}?focus=${encodeURIComponent(id)}`;
}

export function notificationHref(entityType: string | null, entityId: string | null) {
  if (!entityType) return null;
  if (entityType === 'date_proposal') return entityId ? `/features/date-plans?focus=${encodeURIComponent(entityId)}` : '/features/date-plans';
  if (entityType === 'time_capsule') return entityId ? `/features/time-capsules?focus=${encodeURIComponent(entityId)}` : '/features/time-capsules';
  if (entityType === 'question') return '/features/daily-question';
  if (entityType === 'mood') return '/features/mood';
  if (entityType === 'relationship_ping') return '/(tabs)/together';
  if (!entityId) return null;
  if (entityType in featureRoutes) return recordHref(entityType as SearchResult['type'], entityId);
  return null;
}
