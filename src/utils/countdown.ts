import { isValidDateOnly } from './dates';

const DAY_MS = 86_400_000;

export function countdownDateKey(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function countdownStorageIso(dateKey: string) {
  if (!isValidDateOnly(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0, 0)).toISOString();
}

export function localNoonFromDateKey(dateKey: string) {
  if (!isValidDateOnly(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0, 0);
}

export function localDateKeyAt(nowMs = Date.now()) {
  const date = new Date(nowMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ordinal(dateKey: string) {
  if (!isValidDateOnly(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year!, month! - 1, day!) / DAY_MS);
}

export function calendarDaysBetween(fromDateKey: string, toDateKey: string) {
  const from = ordinal(fromDateKey);
  const to = ordinal(toDateKey);
  if (from == null || to == null) return null;
  return to - from;
}

export function countdownRemaining(targetIso: string, nowMs = Date.now()) {
  const targetKey = countdownDateKey(targetIso);
  const todayKey = localDateKeyAt(nowMs);
  const rawDays = calendarDaysBetween(todayKey, targetKey);
  if (rawDays == null) return { days: 0, hours: 0, weeks: 0, passed: true };
  const passed = rawDays < 0;
  const days = Math.max(0, rawDays);
  return {
    days,
    hours: days * 24,
    weeks: Math.floor(days / 7),
    passed,
  };
}

export function countdownProgress(startIso: string | null | undefined, targetIso: string, nowMs = Date.now()) {
  if (!startIso) return null;
  const startKey = countdownDateKey(startIso);
  const targetKey = countdownDateKey(targetIso);
  const todayKey = localDateKeyAt(nowMs);
  const totalDays = calendarDaysBetween(startKey, targetKey);
  const elapsedDays = calendarDaysBetween(startKey, todayKey);
  if (totalDays == null || elapsedDays == null || totalDays <= 0) return null;
  return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
}
