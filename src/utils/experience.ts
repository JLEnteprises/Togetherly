/** A request identifier, not a secret. Reuse it when retrying the same create. */
export function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function formatInZone(value: string, timezone?: string) {
  try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(value)); }
  catch { return 'Time unavailable'; }
}
export function moodResponse(need: string) {
  if (need === 'space') return 'Take your time ♥';
  if (need === 'listen') return 'I’m here to listen';
  if (need === 'call') return 'I saw your request ♥';
  return 'I’m here for you';
}
export function moodIsCurrent(entry: { created_at: string; valid_until?: string | null } | null, now = Date.now()) {
  return Boolean(entry && (entry.valid_until ? Date.parse(entry.valid_until) > now : now - Date.parse(entry.created_at) < 12 * 3600000));
}
