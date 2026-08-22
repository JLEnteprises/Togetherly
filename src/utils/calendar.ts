import type { CoupleEvent, EventRecurrence } from '@/types/database';

export type EventOccurrence = {
  key: string;
  event: CoupleEvent;
  start: Date;
  end: Date | null;
};

export function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthBounds(anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 0, 0, 0, 0);
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  return { start, end, gridStart, gridEnd };
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function advance(date: Date, recurrence: EventRecurrence, anchorDay: number, anchorMonth: number) {
  const next = new Date(date);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else if (recurrence === 'monthly') {
    // Preserve the original day-of-month when possible. Setting Jan 31 directly to
    // February with Date#setMonth would otherwise skip into March.
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(anchorDay, daysInMonth(next.getFullYear(), next.getMonth())));
  } else if (recurrence === 'yearly') {
    // Preserve the original month/day and clamp leap-day events to Feb 28 on
    // non-leap years instead of letting Date overflow into March.
    const targetYear = next.getFullYear() + 1;
    next.setDate(1);
    next.setFullYear(targetYear);
    next.setMonth(anchorMonth);
    next.setDate(Math.min(anchorDay, daysInMonth(targetYear, anchorMonth)));
  }
  return next;
}

export function expandEvent(event: CoupleEvent, rangeStart: Date, rangeEnd: Date): EventOccurrence[] {
  // All-day dates are deliberately reconstructed in the viewer's local zone.
  // This keeps 22 October as 22 October for both partners instead of shifting it
  // because their UTC offsets differ. Timed events continue to use instants.
  const baseStart = event.all_day && event.start_date ? new Date(`${event.start_date}T12:00:00`) : new Date(event.start_at);
  if (!Number.isFinite(baseStart.getTime())) return [];
  const baseEnd = event.all_day && event.end_date ? new Date(`${event.end_date}T12:00:00`) : event.end_at ? new Date(event.end_at) : null;
  const duration = baseEnd && Number.isFinite(baseEnd.getTime()) ? Math.max(0, baseEnd.getTime() - baseStart.getTime()) : null;
  const overlaps = (start: Date, end: Date | null) => (end ?? start).getTime() >= rangeStart.getTime() && start.getTime() <= rangeEnd.getTime();

  if (event.recurrence === 'none') {
    const end = duration == null ? null : new Date(baseStart.getTime() + duration);
    return overlaps(baseStart, end) ? [{ key: `${event.id}:${baseStart.toISOString()}`, event, start: baseStart, end }] : [];
  }

  const result: EventOccurrence[] = [];
  const anchorDay = baseStart.getDate();
  const anchorMonth = baseStart.getMonth();

  // Start close to the requested window instead of walking every historical
  // occurrence. Without this, a daily event created years ago could hit the
  // safety guard before reaching the current calendar view.
  let occurrenceStart = new Date(baseStart);
  if (occurrenceStart.getTime() < rangeStart.getTime()) {
    if (event.recurrence === 'daily' || event.recurrence === 'weekly') {
      const periodDays = event.recurrence === 'daily' ? 1 : 7;
      const roughPeriods = Math.floor((rangeStart.getTime() - baseStart.getTime()) / (periodDays * 86_400_000));
      const periods = Math.max(0, roughPeriods - 2);
      occurrenceStart = new Date(baseStart);
      occurrenceStart.setDate(occurrenceStart.getDate() + periods * periodDays);
    } else if (event.recurrence === 'monthly') {
      const monthDelta = (rangeStart.getFullYear() - baseStart.getFullYear()) * 12 + (rangeStart.getMonth() - baseStart.getMonth());
      const periods = Math.max(0, monthDelta - 2);
      const absoluteMonth = baseStart.getMonth() + periods;
      const targetYear = baseStart.getFullYear() + Math.floor(absoluteMonth / 12);
      const targetMonth = ((absoluteMonth % 12) + 12) % 12;
      occurrenceStart = new Date(baseStart);
      occurrenceStart.setDate(1);
      occurrenceStart.setFullYear(targetYear);
      occurrenceStart.setMonth(targetMonth);
      occurrenceStart.setDate(Math.min(anchorDay, daysInMonth(targetYear, targetMonth)));
    } else if (event.recurrence === 'yearly') {
      const periods = Math.max(0, rangeStart.getFullYear() - baseStart.getFullYear() - 2);
      const targetYear = baseStart.getFullYear() + periods;
      occurrenceStart = new Date(baseStart);
      occurrenceStart.setDate(1);
      occurrenceStart.setFullYear(targetYear);
      occurrenceStart.setMonth(anchorMonth);
      occurrenceStart.setDate(Math.min(anchorDay, daysInMonth(targetYear, anchorMonth)));
    }
  }

  let guard = 0;
  while (occurrenceStart.getTime() <= rangeEnd.getTime() && guard < 2000) {
    const occurrenceEnd = duration == null ? null : new Date(occurrenceStart.getTime() + duration);
    if (overlaps(occurrenceStart, occurrenceEnd)) result.push({ key: `${event.id}:${occurrenceStart.toISOString()}`, event, start: new Date(occurrenceStart), end: occurrenceEnd });
    const next = advance(occurrenceStart, event.recurrence, anchorDay, anchorMonth);
    if (next.getTime() <= occurrenceStart.getTime()) break;
    occurrenceStart = next;
    guard += 1;
  }
  return result;
}

export function expandEvents(events: CoupleEvent[], rangeStart: Date, rangeEnd: Date) {
  return events.flatMap((event) => expandEvent(event, rangeStart, rangeEnd)).sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function monthGrid(anchor: Date) {
  const { gridStart, gridEnd } = monthBounds(anchor);
  const dates: Date[] = [];
  const cursor = new Date(gridStart);
  while (cursor.getTime() <= gridEnd.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
