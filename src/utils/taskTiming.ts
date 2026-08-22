import type { CoupleTask } from '../types/database';

export function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return dateKey;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function taskAttentionDate(task: Pick<CoupleTask, 'start_date' | 'due_date' | 'estimated_minutes'>) {
  if (task.start_date) return task.start_date;
  if (!task.due_date) return null;
  if (!task.estimated_minutes) return task.due_date;
  const planningDays = task.estimated_minutes >= 1440 ? Math.ceil(task.estimated_minutes / 1440) : 0;
  return shiftDateKey(task.due_date, -planningDays);
}

export function durationShortLabel(minutes: number | null | undefined) {
  if (!minutes) return '';
  if (minutes % 10080 === 0) return `${minutes / 10080}w`;
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}
