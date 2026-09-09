const fs = require('fs');
const path = require('path');

const root = process.cwd();
function p(rel) { return path.join(root, rel); }
function read(rel) {
  const f = p(rel);
  if (!fs.existsSync(f)) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  const f = p(rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}
function ensureImport(rel, statement, anchor) {
  let text = read(rel);
  if (text.includes(statement)) return;
  if (!text.includes(anchor)) throw new Error(`Could not add import to ${rel}`);
  text = text.replace(anchor, `${anchor}\n${statement}`);
  write(rel, text);
}
function replaceOnce(rel, oldText, newText, label) {
  let text = read(rel);
  if (text.includes(newText)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const i = text.indexOf(oldText);
  if (i < 0) throw new Error(`Could not safely patch ${rel}: ${label}`);
  if (text.indexOf(oldText, i + oldText.length) >= 0) throw new Error(`Multiple matches in ${rel}: ${label}`);
  text = text.replace(oldText, newText);
  write(rel, text);
}
function replaceRange(rel, startMarker, endMarker, replacement, label) {
  let text = read(rel);
  if (text.includes(replacement)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker in ${rel}: ${label}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker in ${rel}: ${label}`);
  text = text.slice(0, start) + replacement + text.slice(end);
  write(rel, text);
}

// Verify the Release B checkpoint we expect.
for (const [rel, marker] of [
  ['src/components/common/RecordViewSheet.tsx', 'Use ••• on the item card'],
  ['src/components/dashboard/SharedScratchpadCard.tsx', 'Newer version available'],
  ['src/app/features/countdowns.tsx', 'RecordViewSheet visible={!!viewTarget}'],
]) {
  if (!read(rel).includes(marker)) throw new Error(`${rel} is not the expected Release B baseline. Missing: ${marker}`);
}

write('src/utils/countdown.ts', "import { isValidDateOnly } from './dates';\n\nconst DAY_MS = 86_400_000;\n\nexport function countdownDateKey(value: string | null | undefined) {\n  if (!value) return '';\n  const date = new Date(value);\n  if (!Number.isFinite(date.getTime())) return '';\n  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;\n}\n\nexport function countdownStorageIso(dateKey: string) {\n  if (!isValidDateOnly(dateKey)) return null;\n  const [year, month, day] = dateKey.split('-').map(Number);\n  return new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0, 0)).toISOString();\n}\n\nexport function localNoonFromDateKey(dateKey: string) {\n  if (!isValidDateOnly(dateKey)) return null;\n  const [year, month, day] = dateKey.split('-').map(Number);\n  return new Date(year!, month! - 1, day!, 12, 0, 0, 0);\n}\n\nexport function localDateKeyAt(nowMs = Date.now()) {\n  const date = new Date(nowMs);\n  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;\n}\n\nfunction ordinal(dateKey: string) {\n  if (!isValidDateOnly(dateKey)) return null;\n  const [year, month, day] = dateKey.split('-').map(Number);\n  return Math.floor(Date.UTC(year!, month! - 1, day!) / DAY_MS);\n}\n\nexport function calendarDaysBetween(fromDateKey: string, toDateKey: string) {\n  const from = ordinal(fromDateKey);\n  const to = ordinal(toDateKey);\n  if (from == null || to == null) return null;\n  return to - from;\n}\n\nexport function countdownRemaining(targetIso: string, nowMs = Date.now()) {\n  const targetKey = countdownDateKey(targetIso);\n  const todayKey = localDateKeyAt(nowMs);\n  const rawDays = calendarDaysBetween(todayKey, targetKey);\n  if (rawDays == null) return { days: 0, hours: 0, weeks: 0, passed: true };\n  const passed = rawDays < 0;\n  const days = Math.max(0, rawDays);\n  return {\n    days,\n    hours: days * 24,\n    weeks: Math.floor(days / 7),\n    passed,\n  };\n}\n\nexport function countdownProgress(startIso: string | null | undefined, targetIso: string, nowMs = Date.now()) {\n  if (!startIso) return null;\n  const startKey = countdownDateKey(startIso);\n  const targetKey = countdownDateKey(targetIso);\n  const todayKey = localDateKeyAt(nowMs);\n  const totalDays = calendarDaysBetween(startKey, targetKey);\n  const elapsedDays = calendarDaysBetween(startKey, todayKey);\n  if (totalDays == null || elapsedDays == null || totalDays <= 0) return null;\n  return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));\n}\n");

// ------------------------------------------------------------
// COUNTDOWNS: one date-only calendar calculation everywhere.
// ------------------------------------------------------------
ensureImport(
  'src/app/features/countdowns.tsx',
  `import { countdownDateKey, countdownProgress, countdownRemaining, countdownStorageIso, localNoonFromDateKey } from '@/utils/countdown';`,
  `import { useWorkspace } from '@/providers/WorkspaceProvider';`
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `import { isValidDateOnly } from '@/utils/dates';`,
  ``,
  'remove old countdown date import'
);

replaceRange(
  'src/app/features/countdowns.tsx',
  `function storedDateKey(value: string | null | undefined) {`,
  `export default function CountdownsScreen() {`,
  `function formatTarget(target: string) {
  const date = localNoonFromDateKey(countdownDateKey(target));
  return date ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '';
}

`,
  'centralize countdown math'
);

for (const [oldText, newText, label] of [
  [`setDate(storedDateKey(countdown.target_at)); setStartDate(storedDateKey(countdown.start_at));`, `setDate(countdownDateKey(countdown.target_at)); setStartDate(countdownDateKey(countdown.start_at));`, 'edit date keys'],
  [`const targetAt = dateKeyToStorageIso(date); const startAt = startDate ? dateKeyToStorageIso(startDate) : null;`, `const targetAt = countdownStorageIso(date); const startAt = startDate ? countdownStorageIso(startDate) : null;`, 'storage conversion'],
  [`!remaining(item.target_at, nowMs).passed`, `!countdownRemaining(item.target_at, nowMs).passed`, 'upcoming count'],
  [`const time = remaining(countdown.target_at, nowMs); const passed = time.passed; const percent = progress(countdown.start_at, countdown.target_at, nowMs);`, `const time = countdownRemaining(countdown.target_at, nowMs); const passed = time.passed; const percent = countdownProgress(countdown.start_at, countdown.target_at, nowMs);`, 'card countdown math'],
  [`remaining(viewTarget.target_at, nowMs).days`, `countdownRemaining(viewTarget.target_at, nowMs).days`, 'detail days'],
  [`remaining(viewTarget.target_at, nowMs).passed`, `countdownRemaining(viewTarget.target_at, nowMs).passed`, 'detail passed'],
]) replaceOnce('src/app/features/countdowns.tsx', oldText, newText, label);

// ------------------------------------------------------------
// LONG DISTANCE HOME: use exactly the same countdown semantics.
// This also keeps a countdown visible for the whole target day.
// ------------------------------------------------------------
ensureImport(
  'src/components/dashboard/LongDistanceOverviewCard.tsx',
  `import { countdownRemaining } from '@/utils/countdown';`,
  `import { AppIcon } from '@/components/art/AppIcon';`
);
replaceOnce(
  'src/components/dashboard/LongDistanceOverviewCard.tsx',
  `function daysUntil(value: string, now = Date.now()) { return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 86_400_000)); }
`,
  ``,
  'remove millisecond countdown'
);
replaceOnce(
  'src/components/dashboard/LongDistanceOverviewCard.tsx',
  `setCountdown(countdownsResult.value.find((item) => new Date(item.target_at).getTime() >= Date.now()) ?? null);`,
  `setCountdown(countdownsResult.value.find((item) => !countdownRemaining(item.target_at, Date.now()).passed) ?? null);`,
  'keep target-day countdown'
);
replaceOnce(
  'src/components/dashboard/LongDistanceOverviewCard.tsx',
  `\${daysUntil(countdown.target_at, now)} days`,
  `\${countdownRemaining(countdown.target_at, now).days} days`,
  'shared day count'
);

// ------------------------------------------------------------
// AVAILABILITY: Free creates candidate availability; Work/Sleep/
// Busy subtract from it. Overnight blockers are included.
// ------------------------------------------------------------
replaceRange(
  'server/src/routes/availability.ts',
  `function freeIntervals(rows: ScheduleRow[], timezone: string, days: number, now: Date) {`,
  `function overlaps(a: Array<{ start: Date; end: Date }>, b: Array<{ start: Date; end: Date }>, minMinutes: number) {`,
  `type Interval = { start: Date; end: Date };

function mergeIntervals(intervals: Interval[]) {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start.getTime() <= previous.end.getTime()) {
      if (interval.end > previous.end) previous.end = new Date(interval.end);
    } else {
      merged.push({ start: new Date(interval.start), end: new Date(interval.end) });
    }
  }
  return merged;
}

function scheduleIntervals(rows: ScheduleRow[], timezone: string, days: number, now: Date, kinds: readonly ScheduleKind[]) {
  const startDate = dateKeyInZone(now, timezone);
  const intervals: Interval[] = [];

  // Start one local day early so an overnight window from yesterday can
  // correctly carry into today.
  for (let offset = -1; offset <= days; offset += 1) {
    const dateKey = addDays(startDate, offset);
    const dow = weekday(dateKey);
    for (const row of rows) {
      if (!row.enabled || !kinds.includes(row.kind) || Number(row.day_of_week) !== dow) continue;
      const startMinute = Number(row.start_minute);
      const endMinute = Number(row.end_minute);
      const start = zonedLocalToUtc(dateKey, startMinute, timezone);
      const endDateKey = endMinute <= startMinute ? addDays(dateKey, 1) : dateKey;
      const normalizedEndMinute = endMinute === 1440 ? 0 : endMinute;
      const normalizedEndDateKey = endMinute === 1440 ? addDays(dateKey, 1) : endDateKey;
      const end = zonedLocalToUtc(normalizedEndDateKey, normalizedEndMinute, timezone);
      if (end <= now) continue;
      intervals.push({ start: start < now ? new Date(now) : start, end });
    }
  }
  return mergeIntervals(intervals);
}

function subtractIntervals(base: Interval[], blockers: Interval[]) {
  if (!blockers.length) return base;
  const result: Interval[] = [];
  for (const source of base) {
    let pieces: Interval[] = [{ start: new Date(source.start), end: new Date(source.end) }];
    for (const blocker of blockers) {
      const next: Interval[] = [];
      for (const piece of pieces) {
        if (blocker.end <= piece.start || blocker.start >= piece.end) {
          next.push(piece);
          continue;
        }
        if (blocker.start > piece.start) next.push({ start: piece.start, end: new Date(blocker.start) });
        if (blocker.end < piece.end) next.push({ start: new Date(blocker.end), end: piece.end });
      }
      pieces = next;
      if (!pieces.length) break;
    }
    result.push(...pieces);
  }
  return mergeIntervals(result);
}

function effectiveFreeIntervals(rows: ScheduleRow[], timezone: string, days: number, now: Date) {
  const free = scheduleIntervals(rows, timezone, days, now, ['free']);
  const blockers = scheduleIntervals(rows, timezone, days, now, ['work', 'sleep', 'busy']);
  return subtractIntervals(free, blockers);
}

function overlaps(a: Array<{ start: Date; end: Date }>, b: Array<{ start: Date; end: Date }>, minMinutes: number) {`,
  'effective availability math'
);

replaceOnce(
  'server/src/routes/availability.ts',
  `      const rowsResult = await pool.query(\`SELECT * FROM user_schedules WHERE couple_id=$1 AND enabled=true AND kind='free'\`, [coupleId]);
      const [first, second] = membersResult.rows;
      const firstRows = rowsResult.rows.filter((row) => String(row.user_id) === String(first.user_id)) as ScheduleRow[];
      const secondRows = rowsResult.rows.filter((row) => String(row.user_id) === String(second.user_id)) as ScheduleRow[];
      if (!firstRows.length || !secondRows.length) return reply.send({ overlaps: [], reason: 'Both of you need at least one Free window before Togetherly can find overlap.' });
      const now = new Date();
      const result = overlaps(freeIntervals(firstRows, String(first.timezone), days, now), freeIntervals(secondRows, String(second.timezone), days, now), minMinutes);
      return reply.send({ overlaps: result, members: membersResult.rows });`,
  `      const rowsResult = await pool.query(\`SELECT * FROM user_schedules WHERE couple_id=$1 AND enabled=true\`, [coupleId]);
      const [first, second] = membersResult.rows;
      const firstRows = rowsResult.rows.filter((row) => String(row.user_id) === String(first.user_id)) as ScheduleRow[];
      const secondRows = rowsResult.rows.filter((row) => String(row.user_id) === String(second.user_id)) as ScheduleRow[];
      if (!firstRows.some((row) => row.kind === 'free') || !secondRows.some((row) => row.kind === 'free')) {
        return reply.send({ overlaps: [], reason: 'Both of you need at least one Free window before Togetherly can find overlap.' });
      }
      const now = new Date();
      const result = overlaps(
        effectiveFreeIntervals(firstRows, String(first.timezone), days, now),
        effectiveFreeIntervals(secondRows, String(second.timezone), days, now),
        minMinutes,
      );
      return reply.send({
        overlaps: result,
        reason: result.length ? undefined : 'No shared free time remains after Work, Sleep and Busy windows are taken into account.',
        members: membersResult.rows,
      });`,
  'availability overlap route'
);

// Clarify the semantics in the UI.
replaceOnce(
  'src/app/features/availability.tsx',
  `subtitle="Add your usual schedule and find time you’re both free."`,
  `subtitle="Free windows create availability. Work, Sleep and Busy time block it automatically."`,
  'availability header copy'
);
replaceOnce(
  'src/app/features/availability.tsx',
  `body="Add your usual free time."`,
  `body="Add at least one Free window. Work, Sleep and Busy windows will subtract from it."`,
  'availability empty-state copy'
);

// ------------------------------------------------------------
// LOGIC SMOKE: prove countdowns are date-based, not elapsed-ms based.
// ------------------------------------------------------------
replaceOnce(
  'src/utils/logicSmoke.ts',
  `import { taskAttentionDate } from './taskTiming';`,
  `import { taskAttentionDate } from './taskTiming';
import { calendarDaysBetween, countdownProgress, countdownRemaining, countdownStorageIso } from './countdown';`,
  'countdown smoke imports'
);

replaceOnce(
  'src/utils/logicSmoke.ts',
  `  const leapDay = new Date(2028, 1, 29, 9, 0, 0, 0);`,
  `  assert(calendarDaysBetween('2026-03-07', '2026-03-09') === 2, 'Calendar-day math must not depend on daylight-saving hour length.');
  const countdownTarget = countdownStorageIso('2026-10-22');
  const countdownStart = countdownStorageIso('2026-10-20');
  assert(Boolean(countdownTarget && countdownStart), 'Countdown storage dates should parse.');
  const beforeMidnight = new Date(2026, 9, 20, 23, 59, 0, 0).getTime();
  const afterMidnight = new Date(2026, 9, 21, 0, 1, 0, 0).getTime();
  assert(countdownRemaining(countdownTarget!, beforeMidnight).days === 2, 'Countdown should use calendar dates before local midnight.');
  assert(countdownRemaining(countdownTarget!, afterMidnight).days === 1, 'Countdown should decrement at local date rollover, not at an arbitrary timestamp.');
  assert(countdownProgress(countdownStart!, countdownTarget!, new Date(2026, 9, 21, 12, 0, 0, 0).getTime()) === 50, 'Two-day countdown should be 50% complete on the middle calendar day.');

  const leapDay = new Date(2028, 1, 29, 9, 0, 0, 0);`,
  'countdown smoke assertions'
);

replaceOnce(
  'src/utils/logicSmoke.ts',
  `  console.log('PASS smart task attention windows');`,
  `  console.log('PASS smart task attention windows');
  console.log('PASS countdown calendar-day consistency');`,
  'countdown smoke output'
);

// Static audit.
const checks = [
  ['src/utils/countdown.ts', 'calendarDaysBetween'],
  ['src/app/features/countdowns.tsx', 'countdownRemaining(countdown.target_at, nowMs)'],
  ['src/components/dashboard/LongDistanceOverviewCard.tsx', 'countdownRemaining(countdown.target_at, now).days'],
  ['server/src/routes/availability.ts', `['work', 'sleep', 'busy']`],
  ['server/src/routes/availability.ts', 'effectiveFreeIntervals(firstRows'],
  ['src/app/features/availability.tsx', 'Work, Sleep and Busy time block it automatically.'],
  ['src/utils/logicSmoke.ts', 'PASS countdown calendar-day consistency'],
];
const missing = checks.filter(([rel, marker]) => !read(rel).includes(marker)).map(([rel, marker]) => `${rel}: missing ${marker}`);
if (missing.length) {
  fs.writeFileSync(p('RELEASE_C1_DATE_AVAILABILITY_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.error(`C1 audit found ${missing.length} issue(s). See RELEASE_C1_DATE_AVAILABILITY_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_C1_DATE_AVAILABILITY_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('C1 date/availability audit clean.');
}

console.log('');
console.log('Release C1 applied.');
console.log('No migration required.');
console.log('Run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
