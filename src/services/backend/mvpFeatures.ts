import { apiRequest } from './api';
import type {
  ActivityCost,
  ActivityEnvironment,
  ActivityLocationType,
  ActivityMood,
  ActivityStatus,
  ActivityTime,
  CoupleActivity,
  CoupleEvent,
  CoupleGoal,
  CoupleMemory,
  CoupleTrip,
  DailyQuestionState,
  DailyQuestionHistoryEntry,
  EventRecurrence,
  GoalStatus,
  MoodEntry,
  MoodValue,
  NeedValue,
  SearchResult,
  Tag,
  UserPreferences,
  InAppNotification,
  TripLink,
  TripLinkType,
  PushDevice,
  WatchSession,
  WatchState,
  MemoryAlbum,
  DrawingData,
} from '@/types/database';

export async function getEvents() { return (await apiRequest<{ events: CoupleEvent[] }>('/events')).events; }
export async function createEvent(input: {
  title: string; description?: string; startAt: string; endAt?: string | null; startDate?: string | null; endDate?: string | null; allDay?: boolean; location?: string;
  recurrence?: EventRecurrence; assignee?: 'me' | 'partner' | 'both'; tagIds?: string[];
}) { return (await apiRequest<{ event: CoupleEvent }>('/events', { method: 'POST', body: input })).event; }
export async function updateEvent(id: string, input: Partial<{
  title: string; description: string; startAt: string; endAt: string | null; startDate: string | null; endDate: string | null; allDay: boolean; location: string;
  recurrence: EventRecurrence; assignee: 'me' | 'partner' | 'both'; tagIds: string[];
}>) { return (await apiRequest<{ event: CoupleEvent }>(`/events/${id}`, { method: 'PATCH', body: input })).event; }
export function deleteEvent(id: string) { return apiRequest<void>(`/events/${id}`, { method: 'DELETE' }); }

export async function getGoals() { return (await apiRequest<{ goals: CoupleGoal[] }>('/goals')).goals; }
export async function createGoal(input: { title: string; description?: string; currentValue?: number; targetValue: number; unit?: string; deadline?: string | null; tagIds?: string[] }) {
  return (await apiRequest<{ goal: CoupleGoal }>('/goals', { method: 'POST', body: input })).goal;
}
export async function updateGoal(id: string, input: Partial<{ title: string; description: string; currentValue: number; targetValue: number; unit: string; deadline: string | null; status: GoalStatus; tagIds: string[] }>) {
  return (await apiRequest<{ goal: CoupleGoal }>(`/goals/${id}`, { method: 'PATCH', body: input })).goal;
}
export async function contributeToGoal(id: string, amount: number, note?: string) {
  return (await apiRequest<{ goal: CoupleGoal }>(`/goals/${id}/contributions`, { method: 'POST', body: { amount, note } })).goal;
}
export function deleteGoal(id: string) { return apiRequest<void>(`/goals/${id}`, { method: 'DELETE' }); }

export async function getTrips() { return (await apiRequest<{ trips: CoupleTrip[] }>('/trips')).trips; }
export async function getTrip(id: string) { return apiRequest<{ trip: CoupleTrip; links: TripLink[] }>(`/trips/${id}`); }
export async function linkTripItem(tripId: string, entityType: TripLinkType, entityId: string) { return apiRequest<{ link: TripLink }>(`/trips/${tripId}/links`, { method: 'POST', body: { entityType, entityId } }); }
export function unlinkTripItem(tripId: string, entityType: TripLinkType, entityId: string) { return apiRequest<void>(`/trips/${tripId}/links/${entityType}/${entityId}`, { method: 'DELETE' }); }
export async function createTrip(input: { title: string; destination?: string; startDate?: string | null; endDate?: string | null; notes?: string; tagIds?: string[] }) {
  return (await apiRequest<{ trip: CoupleTrip }>('/trips', { method: 'POST', body: input })).trip;
}
export async function updateTrip(id: string, input: Partial<{ title: string; destination: string; startDate: string | null; endDate: string | null; notes: string; tagIds: string[] }>) {
  return (await apiRequest<{ trip: CoupleTrip }>(`/trips/${id}`, { method: 'PATCH', body: input })).trip;
}
export function deleteTrip(id: string) { return apiRequest<void>(`/trips/${id}`, { method: 'DELETE' }); }

export async function getMemories() { return (await apiRequest<{ memories: CoupleMemory[] }>('/memories')).memories; }
export async function createMemory(input: { title: string; description?: string; memoryDate: string; location?: string; isMilestone?: boolean; emoji?: string; photoUrl?: string | null; photoUrls?: string[]; tagIds?: string[] }) {
  return (await apiRequest<{ memory: CoupleMemory }>('/memories', { method: 'POST', body: input })).memory;
}
export async function updateMemory(id: string, input: Partial<{ title: string; description: string; memoryDate: string; location: string; isMilestone: boolean; emoji: string; photoUrl: string | null; photoUrls: string[]; tagIds: string[] }>) {
  return (await apiRequest<{ memory: CoupleMemory }>(`/memories/${id}`, { method: 'PATCH', body: input })).memory;
}
export function deleteMemory(id: string) { return apiRequest<void>(`/memories/${id}`, { method: 'DELETE' }); }
export async function getRandomMemory() { return (await apiRequest<{ memory: CoupleMemory | null }>('/memory-jar/random')).memory; }
export async function getTimeline() { return apiRequest<{ couple: { relationship_start_date: string | null; anniversary_date: string | null } | null; milestones: CoupleMemory[] }>('/timeline'); }

export async function getMemoryAlbums() { return (await apiRequest<{ albums: MemoryAlbum[] }>('/memory-albums')).albums; }
export async function createMemoryAlbum(input: { title: string; description?: string }) { return (await apiRequest<{ album: MemoryAlbum }>('/memory-albums', { method: 'POST', body: input })).album; }
export async function updateMemoryAlbum(id: string, input: Partial<{ title: string; description: string }>) { return (await apiRequest<{ album: MemoryAlbum }>(`/memory-albums/${id}`, { method: 'PATCH', body: input })).album; }
export async function getMemoryAlbum(id: string) { return apiRequest<{ album: MemoryAlbum; memories: CoupleMemory[] }>(`/memory-albums/${id}`); }
export function addMemoryToAlbum(albumId: string, memoryId: string) { return apiRequest<{ ok: boolean }>(`/memory-albums/${albumId}/memories`, { method: 'POST', body: { memoryId } }); }
export function removeMemoryFromAlbum(albumId: string, memoryId: string) { return apiRequest<void>(`/memory-albums/${albumId}/memories/${memoryId}`, { method: 'DELETE' }); }
export function deleteMemoryAlbum(id: string) { return apiRequest<void>(`/memory-albums/${id}`, { method: 'DELETE' }); }

export async function getActivities() { return (await apiRequest<{ activities: CoupleActivity[] }>('/activities')).activities; }
export async function createActivity(input: {
  title: string; description?: string; costLevel?: ActivityCost; durationMinutes?: number | null; locationType?: ActivityLocationType; location?: string;
  environment?: ActivityEnvironment; timeOfDay?: ActivityTime; mood?: ActivityMood; status?: ActivityStatus; kidFriendly?: boolean; bookingRequired?: boolean; rating?: number | null; tagIds?: string[];
}) { return (await apiRequest<{ activity: CoupleActivity }>('/activities', { method: 'POST', body: input })).activity; }
export async function updateActivity(id: string, input: Partial<{
  title: string; description: string; costLevel: ActivityCost; durationMinutes: number | null; locationType: ActivityLocationType; location: string;
  environment: ActivityEnvironment; timeOfDay: ActivityTime; mood: ActivityMood; status: ActivityStatus; kidFriendly: boolean; bookingRequired: boolean; rating: number | null; tagIds: string[];
}>) { return (await apiRequest<{ activity: CoupleActivity }>(`/activities/${id}`, { method: 'PATCH', body: input })).activity; }
export function deleteActivity(id: string) { return apiRequest<void>(`/activities/${id}`, { method: 'DELETE' }); }
export async function setActivityInterest(id: string, interested: boolean) { return apiRequest<{ interested: boolean }>(`/activities/${id}/interest`, { method: 'POST', body: { interested } }); }
export async function rejectActivity(id: string) { return (await apiRequest<{ activity: CoupleActivity }>(`/activities/${id}/reject`, { method: 'POST' })).activity; }
export async function randomActivity(filters: Partial<{ cost: ActivityCost; locationType: ActivityLocationType; environment: ActivityEnvironment; mood: ActivityMood; timeOfDay: ActivityTime; maxMinutes: number; kidFriendly: boolean; tagIds: string[] }>) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === 'any') return;
    query.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const queryString = query.toString();
  return (await apiRequest<{ activity: CoupleActivity | null }>(`/activities/random${queryString ? `?${queryString}` : ''}`)).activity;
}

export function getDailyQuestion() { return apiRequest<DailyQuestionState>('/daily-question'); }
export async function getDailyQuestionHistory(limit = 60) { return (await apiRequest<{ history: DailyQuestionHistoryEntry[] }>(`/daily-question/history?limit=${Math.max(1, Math.min(180, Math.round(limit)))}`)).history; }
export async function answerDailyQuestion(questionId: string, answer: string) { return apiRequest<{ answer: unknown }>('/daily-question/answer', { method: 'POST', body: { questionId, answer } }); }
export async function updateDailyQuestionSettings(disabledCategories: string[]) { return apiRequest<{ disabledCategories: string[] }>('/daily-question/settings', { method: 'PATCH', body: { disabledCategories } }); }
export async function getLatestMoods() { return apiRequest<{ mine: MoodEntry | null; partner: MoodEntry | null }>('/moods/latest'); }
export async function createMood(input: { mood: MoodValue; need: NeedValue; visibility: 'shared' | 'private' }) { return (await apiRequest<{ mood: MoodEntry }>('/moods', { method: 'POST', body: input })).mood; }
export function acknowledgeMood(moodId: string) { return apiRequest<{ ok: true }>(`/moods/${moodId}/acknowledge`, { method: 'POST' }); }

export async function getTags() { return (await apiRequest<{ tags: Tag[] }>('/tags')).tags; }
export async function createTag(name: string, icon?: string, iconDrawing?: DrawingData | null) { return (await apiRequest<{ tag: Tag }>('/tags', { method: 'POST', body: { name, icon, iconDrawing } })).tag; }
export async function updateTag(id: string, input: { name?: string; icon?: string | null; iconDrawing?: DrawingData | null }) { return (await apiRequest<{ tag: Tag }>(`/tags/${id}`, { method: 'PATCH', body: input })).tag; }
export async function bootstrapTags() { return (await apiRequest<{ tags: Tag[] }>('/tags/bootstrap', { method: 'POST' })).tags; }
export function deleteTag(id: string) { return apiRequest<void>(`/tags/${id}`, { method: 'DELETE' }); }

export async function getPreferences() { return (await apiRequest<{ preferences: UserPreferences }>('/preferences')).preferences; }
export async function updatePreferences(input: Partial<{
  reducedMotion: boolean; haptics: boolean; highContrast: boolean; notificationEvents: boolean; notificationTasks: boolean; notificationCountdowns: boolean; notificationPartnerActivity: boolean; notificationDailyQuestion: boolean; notificationPartnerMood: boolean; notificationGoalMilestones: boolean; notificationMemories: boolean; notificationVisitApproaching: boolean; notificationRelationshipPings: boolean;
  backdropTheme: UserPreferences['backdrop_theme'];
}>) { return (await apiRequest<{ preferences: UserPreferences }>('/preferences', { method: 'PATCH', body: input })).preferences; }
export function swapParticipantColors() { return apiRequest<{ ok: true }>('/workspace/colors/swap', { method: 'POST' }); }

export async function searchEverything(q: string) { return (await apiRequest<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}`)).results; }


export function refreshScheduledReminders() { return apiRequest<{ ok: true }>('/notifications/reminders/refresh', { method: 'POST' }); }

export async function getNotifications(unreadOnly = false) {
  return apiRequest<{ notifications: InAppNotification[]; unreadCount: number }>(`/notifications?unreadOnly=${unreadOnly ? 'true' : 'false'}`);
}
export async function markNotificationRead(id: string) {
  return (await apiRequest<{ notification: InAppNotification }>(`/notifications/${id}/read`, { method: 'POST' })).notification;
}
export function markAllNotificationsRead() { return apiRequest<{ ok: true }>('/notifications/read-all', { method: 'POST' }); }
export function deleteNotification(id: string) { return apiRequest<void>(`/notifications/${id}`, { method: 'DELETE' }); }


export async function getPushDevices() {
  return (await apiRequest<{ devices: PushDevice[] }>('/notifications/push/devices')).devices;
}
export async function registerPushDevice(input: { token: string; platform: 'ios' | 'android'; deviceName?: string }) {
  return (await apiRequest<{ device: PushDevice }>('/notifications/push/register', { method: 'POST', body: input })).device;
}
export function deactivatePushToken(token: string) {
  return apiRequest<void>('/notifications/push/token', { method: 'DELETE', body: { token } });
}
export function sendTestPush() {
  return apiRequest<{ ok: true; sent?: number }>('/notifications/push/test', { method: 'POST' });
}
export async function createRelationshipPing(kind: 'love' | 'thinking_of_you') {
  return (await apiRequest<{ ping: { id: string; kind: 'love' | 'thinking_of_you'; recipientUserId: string } }>('/relationship-pings', { method: 'POST', body: { kind } })).ping;
}
export async function createWatchSession(deviceName = 'Apple Watch') {
  return (await apiRequest<{ watchSession: WatchSession }>('/watch/session', { method: 'POST', body: { deviceName } })).watchSession;
}
export function revokeWatchSessions() { return apiRequest<void>('/watch/sessions', { method: 'DELETE' }); }
export async function getWatchStateForPhone() { return (await apiRequest<{ state: WatchState }>('/watch/state/phone')).state; }
