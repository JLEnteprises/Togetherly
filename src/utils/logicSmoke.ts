import { expandEvent } from './calendar';
import { isValidDateOnly, parseLocalDateTimeInput } from './dates';
import type { CoupleEvent } from '../types/database';
import { taskAttentionDate } from './taskTiming';
import { calendarDaysBetween, countdownProgress, countdownRemaining, countdownStorageIso } from './countdown';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function dateParts(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
}

function eventAt(localStart: Date, recurrence: CoupleEvent['recurrence']): CoupleEvent {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    couple_id: '00000000-0000-4000-8000-000000000002',
    creator_id: '00000000-0000-4000-8000-000000000003',
    assigned_user_id: null,
    assign_to_both: true,
    title: 'Logic smoke event',
    description: '',
    start_at: localStart.toISOString(),
    end_at: null,
    all_day: false,
    location: '',
    recurrence,
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function run() {
  assert(isValidDateOnly('2028-02-29'), 'Leap-day date should be valid.');
  assert(!isValidDateOnly('2027-02-29'), 'Non-leap Feb 29 should be invalid.');
  assert(!isValidDateOnly('2026-02-31'), 'Feb 31 should be invalid.');
  assert(parseLocalDateTimeInput('2026-02-31 12:00') === null, 'Invalid local date/time must be rejected.');
  assert(Boolean(parseLocalDateTimeInput('2026-10-22 20:15')), 'Valid local date/time should parse.');

  const jan31 = new Date(2026, 0, 31, 10, 0, 0, 0);
  const monthly = expandEvent(eventAt(jan31, 'monthly'), new Date(2026, 0, 1), new Date(2026, 4, 31, 23, 59, 59));
  const monthlyParts = monthly.map((item) => dateParts(item.start));
  assert(monthlyParts.includes('2026-2-28'), `Jan 31 monthly recurrence should clamp to Feb 28, got ${monthlyParts.join(', ')}`);
  assert(monthlyParts.includes('2026-3-31'), `Monthly recurrence should return to Mar 31, got ${monthlyParts.join(', ')}`);
  assert(monthlyParts.includes('2026-4-30'), `Monthly recurrence should clamp to Apr 30, got ${monthlyParts.join(', ')}`);

  const oldDaily = new Date(2018, 0, 1, 8, 30, 0, 0);
  const recentDaily = expandEvent(eventAt(oldDaily, 'daily'), new Date(2026, 7, 20, 0, 0, 0), new Date(2026, 7, 21, 23, 59, 59));
  assert(recentDaily.length >= 2, `Long-running daily recurrence should fast-forward into the current window, got ${recentDaily.length} occurrence(s)`);
  assert(recentDaily.some((item) => dateParts(item.start) === '2026-8-20'), 'Long-running daily recurrence should include the current date.');

  const allDay: CoupleEvent = {
    ...eventAt(new Date('2026-10-21T14:00:00.000Z'), 'none'),
    all_day: true,
    start_at: '2026-10-21T14:00:00.000Z',
    start_date: '2026-10-22',
    end_date: null,
  };
  const allDayOccurrences = expandEvent(allDay, new Date(2026, 9, 22, 0, 0, 0), new Date(2026, 9, 22, 23, 59, 59));
  assert(allDayOccurrences.length === 1 && dateParts(allDayOccurrences[0]!.start) === '2026-10-22', 'All-day event must render from its date-only field, not shift with the timestamp timezone.');

  assert(taskAttentionDate({ start_date: '2026-08-20', due_date: '2026-08-29', estimated_minutes: 10080 }) === '2026-08-20', 'Explicit task start date should win over the duration-derived attention date.');
  assert(taskAttentionDate({ start_date: null, due_date: '2026-08-29', estimated_minutes: 10080 }) === '2026-08-22', 'One-week task estimate should surface one week before its due date.');
  assert(taskAttentionDate({ start_date: null, due_date: '2026-08-29', estimated_minutes: 120 }) === '2026-08-29', 'Sub-day task estimates should surface on the due date rather than a full day early.');

  assert(calendarDaysBetween('2026-03-07', '2026-03-09') === 2, 'Calendar-day math must not depend on daylight-saving hour length.');
  const countdownTarget = countdownStorageIso('2026-10-22');
  const countdownStart = countdownStorageIso('2026-10-20');
  assert(Boolean(countdownTarget && countdownStart), 'Countdown storage dates should parse.');
  const beforeMidnight = new Date(2026, 9, 20, 23, 59, 0, 0).getTime();
  const afterMidnight = new Date(2026, 9, 21, 0, 1, 0, 0).getTime();
  assert(countdownRemaining(countdownTarget!, beforeMidnight).days === 2, 'Countdown should use calendar dates before local midnight.');
  assert(countdownRemaining(countdownTarget!, afterMidnight).days === 1, 'Countdown should decrement at local date rollover, not at an arbitrary timestamp.');
  assert(countdownProgress(countdownStart!, countdownTarget!, new Date(2026, 9, 21, 12, 0, 0, 0).getTime()) === 50, 'Two-day countdown should be 50% complete on the middle calendar day.');

  const leapDay = new Date(2028, 1, 29, 9, 0, 0, 0);
  const yearly = expandEvent(eventAt(leapDay, 'yearly'), new Date(2028, 0, 1), new Date(2030, 11, 31));
  const yearlyParts = yearly.map((item) => dateParts(item.start));
  assert(yearlyParts.includes('2029-2-28'), `Leap-day yearly recurrence should clamp to Feb 28, got ${yearlyParts.join(', ')}`);
  assert(yearlyParts.includes('2030-2-28'), `Leap-day yearly recurrence should stay in February, got ${yearlyParts.join(', ')}`);

  console.log('PASS strict date-only validation');
  console.log('PASS strict local date-time validation');
  console.log('PASS monthly recurrence month-end clamping');
  console.log('PASS long-running recurrence fast-forward');
  console.log('PASS timezone-free all-day calendar dates');
  console.log('PASS yearly leap-day recurrence clamping');
  console.log('PASS smart task attention windows');
  console.log('PASS countdown calendar-day consistency');
  console.log('Logic smoke checks passed.');
}

run();
