const fs = require('fs');
const path = require('path');

const root = process.cwd();
function p(rel) { return path.join(root, rel); }
function read(rel) {
  const file = p(rel);
  if (!fs.existsSync(file)) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
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

// Verify C1 is the baseline.
for (const [rel, marker] of [
  ['src/utils/countdown.ts', 'calendarDaysBetween'],
  ['server/src/routes/availability.ts', 'effectiveFreeIntervals'],
  ['src/app/features/goals.tsx', 'RecordViewSheet visible={!!viewTarget}'],
  ['src/app/features/trip-detail.tsx', 'Quick setup'],
]) {
  if (!read(rel).includes(marker)) throw new Error(`${rel} is not the expected C1 baseline. Missing: ${marker}`);
}

write('server/migrations/014_trip_goal_integrity.sql', "-- Togetherly Release C2: trip-managed planning links + goal history integrity.\n\nALTER TABLE trip_links\n  ADD COLUMN IF NOT EXISTS managed_by_trip boolean NOT NULL DEFAULT false;\n\n-- Recognise quick-setup links created by older Togetherly builds where it is\n-- safe to infer ownership from the generated naming/date pattern.\nUPDATE trip_links tl\nSET managed_by_trip = true\nFROM trips tr, countdowns c\nWHERE tl.trip_id = tr.id\n  AND tl.entity_type = 'countdown'\n  AND tl.entity_id = c.id\n  AND c.couple_id = tr.couple_id\n  AND c.title = tr.title || ' begins';\n\nUPDATE trip_links tl\nSET managed_by_trip = true\nFROM trips tr, events e\nWHERE tl.trip_id = tr.id\n  AND tl.entity_type = 'event'\n  AND tl.entity_id = e.id\n  AND e.couple_id = tr.couple_id\n  AND e.all_day = true\n  AND tr.start_date IS NOT NULL\n  AND e.start_date = tr.start_date\n  AND e.title = tr.title;\n\n-- Existing goals may have been directly edited before C2. Preserve their\n-- visible total by recording the gap as one historical baseline contribution.\nWITH totals AS (\n  SELECT\n    g.id,\n    g.creator_id,\n    g.current_value,\n    g.created_at,\n    COALESCE(SUM(gc.amount), 0)::numeric(14,2) AS contribution_total\n  FROM goals g\n  LEFT JOIN goal_contributions gc ON gc.goal_id = g.id\n  GROUP BY g.id, g.creator_id, g.current_value, g.created_at\n),\ngaps AS (\n  SELECT\n    id,\n    creator_id,\n    created_at,\n    (current_value - contribution_total)::numeric(14,2) AS gap\n  FROM totals\n)\nINSERT INTO goal_contributions(id, goal_id, creator_id, amount, note, created_at)\nSELECT\n  (\n    substr(md5(id::text || ':c2-baseline'), 1, 8) || '-' ||\n    substr(md5(id::text || ':c2-baseline'), 9, 4) || '-' ||\n    substr(md5(id::text || ':c2-baseline'), 13, 4) || '-' ||\n    substr(md5(id::text || ':c2-baseline'), 17, 4) || '-' ||\n    substr(md5(id::text || ':c2-baseline'), 21, 12)\n  )::uuid,\n  id,\n  creator_id,\n  gap,\n  'Imported previous total',\n  created_at\nFROM gaps\nWHERE gap <> 0\nON CONFLICT (id) DO NOTHING;\n");

// ------------------------------------------------------------
// TYPES + CLIENT API
// ------------------------------------------------------------
replaceOnce(
  'src/types/database.ts',
  `export type TripLink = { entity_type: TripLinkType; entity_id: string; created_by: string; created_at: string; title: string; subtitle: string };`,
  `export type TripLink = { entity_type: TripLinkType; entity_id: string; created_by: string; created_at: string; managed_by_trip: boolean; title: string; subtitle: string };`,
  'trip managed-link type'
);

replaceOnce(
  'src/services/backend/mvpFeatures.ts',
  `export async function linkTripItem(tripId: string, entityType: TripLinkType, entityId: string) { return apiRequest<{ link: TripLink }>(\`/trips/\${tripId}/links\`, { method: 'POST', body: { entityType, entityId } }); }`,
  `export async function linkTripItem(tripId: string, entityType: TripLinkType, entityId: string, managedByTrip = false) { return apiRequest<{ link: TripLink }>(\`/trips/\${tripId}/links\`, { method: 'POST', body: { entityType, entityId, managedByTrip } }); }`,
  'trip link ownership API'
);

replaceOnce(
  'src/services/backend/mvpFeatures.ts',
  `export async function updateGoal(id: string, input: Partial<{ title: string; description: string; currentValue: number; targetValue: number; unit: string; deadline: string | null; status: GoalStatus; tagIds: string[] }>) {`,
  `export async function updateGoal(id: string, input: Partial<{ title: string; description: string; targetValue: number; unit: string; deadline: string | null; status: GoalStatus; tagIds: string[] }>) {`,
  'goal current value no longer directly editable'
);

// ------------------------------------------------------------
// TRIP DETAIL: mark quick-generated event/countdown as trip-managed.
// Existing manual links remain independent.
// ------------------------------------------------------------
replaceOnce(
  'src/app/features/trip-detail.tsx',
  `await linkTripItem(id, 'countdown', countdown.id);`,
  `await linkTripItem(id, 'countdown', countdown.id, true);`,
  'managed trip countdown'
);
replaceOnce(
  'src/app/features/trip-detail.tsx',
  `await linkTripItem(id, 'event', event.id);`,
  `await linkTripItem(id, 'event', event.id, true);`,
  'managed trip event'
);
replaceOnce(
  'src/app/features/trip-detail.tsx',
  `<AppText variant="caption" tone="secondary">{item.entity_type.toUpperCase()}</AppText>`,
  `<AppText variant="caption" tone="secondary">{item.entity_type.toUpperCase()}{item.managed_by_trip ? ' · SYNCED TO TRIP' : ''}</AppText>`,
  'trip sync badge'
);

// ------------------------------------------------------------
// GOALS UI: current progress is history-backed. New goals can have
// a starting amount; edits change metadata/target only.
// ------------------------------------------------------------
replaceRange(
  'src/app/features/goals.tsx',
  `  async function saveGoal() {`,
  `  async function contribute(goal: CoupleGoal) {`,
  `  async function saveGoal() {
    const targetValue = Number(target);
    const startingValue = Number(current || '0');
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0 || (!editingId && (!Number.isFinite(startingValue) || startingValue < 0))) {
      Alert.alert('Check the goal', 'Add a title and a target greater than zero.');
      return;
    }
    setBusy(true);
    try {
      const common = { title: title.trim(), description, targetValue, unit: unit.trim(), deadline: deadline || null, tagIds: selectedTags };
      if (editingId) await updateGoal(editingId, common);
      else await createGoal({ ...common, currentValue: startingValue });
      resetEditor();
      await refresh();
    } catch (error) {
      Alert.alert(editingId ? 'Couldn’t update goal' : 'Couldn’t create goal', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }
`,
  'goal history-backed save'
);

replaceOnce(
  'src/app/features/goals.tsx',
  `<View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><FormField label="CURRENT" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" placeholder="0" /></View><View style={{ flex: 1 }}><FormField label="TARGET" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="4000" /></View><View style={{ width: 84 }}><FormField label="UNIT" value={unit} onChangeText={setUnit} placeholder="$" /></View></View>`,
  `{!editingId ? <FormField label="STARTING AMOUNT · OPTIONAL" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" placeholder="0" /> : <AppText variant="bodySmall" tone="muted">Progress is changed through Add progress so the contribution history always matches the total.</AppText>}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><FormField label="TARGET" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="4000" /></View><View style={{ width: 84 }}><FormField label="UNIT" value={unit} onChangeText={setUnit} placeholder="$" /></View></View>`,
  'goal editor removes direct current-value edit'
);

// ------------------------------------------------------------
// SERVER: expose managed links.
// ------------------------------------------------------------
replaceOnce(
  'server/src/routes/planning.ts',
  `SELECT tl.entity_type, tl.entity_id, tl.created_by, tl.created_at,`,
  `SELECT tl.entity_type, tl.entity_id, tl.created_by, tl.created_at, tl.managed_by_trip,`,
  'trip link select includes ownership'
);

// ------------------------------------------------------------
// SERVER: new goals write starting value to contribution history.
// ------------------------------------------------------------
replaceRange(
  'server/src/routes/planning.ts',
  `  app.post('/goals', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.patch('/goals/:id', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.post('/goals', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const targetValue = numberOrNull(body.targetValue, 'Target', 0.01);
      if (targetValue == null) throw new ApiError(400, 'Target is required.');
      const currentValue = numberOrNull(body.currentValue, 'Starting amount', 0) ?? 0;
      const id = randomUUID();

      await client.query('BEGIN');
      const result = await client.query(
        \`INSERT INTO goals(id,couple_id,creator_id,title,description,current_value,target_value,unit,deadline,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *\`,
        [id, coupleId, request.userId, requiredText(body.title, 'Goal title', 160), optionalText(body.description, 5000), currentValue, targetValue,
          optionalText(body.unit, 30), dateOnlyOrNull(body.deadline, 'Deadline'), currentValue >= targetValue ? 'completed' : 'active'],
      );
      if (currentValue !== 0) {
        await client.query(
          'INSERT INTO goal_contributions(id,goal_id,creator_id,amount,note) VALUES($1,$2,$3,$4,$5)',
          [randomUUID(), id, request.userId, currentValue, 'Starting amount'],
        );
      }
      await client.query('COMMIT');

      await setTags(coupleId, 'goal', id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'goal', entityId: id, title: 'New shared goal', body: String(result.rows[0].title) });
      broadcast(realtime, coupleId, 'goals', 'created', id);
      return reply.code(201).send({ goal: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally {
      client.release();
    }
  });

`,
  'goal create writes starting contribution'
);

// ------------------------------------------------------------
// SERVER: goal PATCH cannot mutate current_value. Old clients that
// merely echo the same total still work; attempts to change it fail.
// ------------------------------------------------------------
replaceRange(
  'server/src/routes/planning.ts',
  `  app.patch('/goals/:id', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.post('/goals/:id/contributions', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.patch('/goals/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const currentResult = await pool.query('SELECT * FROM goals WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Goal not found.');

      const currentValue = Number(current.current_value);
      if (body.currentValue !== undefined) {
        const requestedCurrent = numberOrNull(body.currentValue, 'Current value', 0) ?? 0;
        if (requestedCurrent !== currentValue) {
          throw new ApiError(400, 'Goal progress is history-backed. Use Add progress (or a negative correction) instead of editing the total directly.');
        }
      }

      const targetValue = body.targetValue === undefined ? Number(current.target_value) : numberOrNull(body.targetValue, 'Target', 0.01);
      if (targetValue == null) throw new ApiError(400, 'Target is required.');
      const requestedStatus = body.status === undefined ? current.status : oneOf(body.status, ['active','paused','completed'] as const, current.status);
      const status = currentValue >= targetValue && requestedStatus !== 'paused' ? 'completed' : requestedStatus;
      const result = await pool.query(
        \`UPDATE goals SET title=$1,description=$2,target_value=$3,unit=$4,deadline=$5,status=$6,updated_at=now()
         WHERE id=$7 AND couple_id=$8 RETURNING *\`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Goal title', 160),
          body.description === undefined ? current.description : optionalText(body.description, 5000), targetValue,
          body.unit === undefined ? current.unit : optionalText(body.unit, 30),
          body.deadline === undefined ? current.deadline : dateOnlyOrNull(body.deadline, 'Deadline'),
          status, id, coupleId],
      );
      await setTags(coupleId, 'goal', id, body.tagIds);
      broadcast(realtime, coupleId, 'goals', 'updated', id);
      return reply.send({ goal: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

`,
  'goal patch protects contribution total'
);

// ------------------------------------------------------------
// SERVER: managed quick-setup links are explicit.
// ------------------------------------------------------------
replaceRange(
  'server/src/routes/planning.ts',
  `  app.post('/trips/:id/links', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.delete('/trips/:id/links/:entityType/:entityId', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.post('/trips/:id/links', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      uuidValue(id, 'Trip');
      await requireTrip(coupleId, id);
      const body = request.body as Record<string, unknown>;
      const entityType = tripLinkType(body.entityType);
      const entityId = uuidValue(body.entityId, 'Linked item');
      const entity = await validateTripEntity(coupleId, entityType, entityId);
      const managedByTrip = body.managedByTrip === true && (entityType === 'countdown' || entityType === 'event');
      const linked = await pool.query(
        \`INSERT INTO trip_links(trip_id,entity_type,entity_id,created_by,managed_by_trip)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (trip_id,entity_type,entity_id)
         DO UPDATE SET managed_by_trip=EXCLUDED.managed_by_trip
         RETURNING managed_by_trip\`,
        [id, entityType, entityId, request.userId, managedByTrip],
      );
      broadcast(realtime, coupleId, 'trips', 'linked', id);
      return reply.code(201).send({ link: { entity_type: entityType, entity_id: entityId, title: entity.title, managed_by_trip: Boolean(linked.rows[0]?.managed_by_trip) } });
    } catch (error) {
      return sendError(reply, error);
    }
  });

`,
  'trip link managed ownership'
);

// ------------------------------------------------------------
// SERVER: editing a trip synchronizes only the countdown/event
// generated by Quick setup (or safely backfilled as such).
// Manually linked records remain independent.
// ------------------------------------------------------------
replaceRange(
  'server/src/routes/planning.ts',
  `  app.patch('/trips/:id', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.delete('/trips/:id', { preHandler: authenticate }, async (request, reply) => {`,
  `  app.patch('/trips/:id', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);

      await client.query('BEGIN');
      const currentResult = await client.query('SELECT * FROM trips WHERE id=$1 AND couple_id=$2 FOR UPDATE', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Trip not found.');

      const startDate = body.startDate === undefined ? current.start_date : dateOnlyOrNull(body.startDate, 'Start date');
      const endDate = body.endDate === undefined ? current.end_date : dateOnlyOrNull(body.endDate, 'End date');
      if (startDate && endDate && String(endDate) < String(startDate)) throw new ApiError(400, 'Trip end date cannot be before the start date.');

      const result = await client.query(
        \`UPDATE trips SET title=$1,destination=$2,start_date=$3,end_date=$4,notes=$5,updated_at=now()
         WHERE id=$6 AND couple_id=$7 RETURNING *\`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Trip title', 160),
          body.destination === undefined ? current.destination : optionalText(body.destination, 250),
          startDate, endDate,
          body.notes === undefined ? current.notes : optionalText(body.notes, 5000),
          id, coupleId],
      );
      const trip = result.rows[0];
      let countdownIds: string[] = [];
      let eventIds: string[] = [];

      if (startDate) {
        const targetAt = \`\${String(startDate)}T12:00:00.000Z\`;
        const countdownResult = await client.query(
          \`UPDATE countdowns c
           SET title=$1, target_at=$2, updated_at=now()
           FROM trip_links tl
           WHERE tl.trip_id=$3
             AND tl.entity_type='countdown'
             AND tl.entity_id=c.id
             AND tl.managed_by_trip=true
             AND c.couple_id=$4
           RETURNING c.id\`,
          [\`\${String(trip.title)} begins\`, targetAt, id, coupleId],
        );
        countdownIds = countdownResult.rows.map((row) => String(row.id));

        const endAt = endDate ? \`\${String(endDate)}T12:00:00.000Z\` : null;
        const eventResult = await client.query(
          \`UPDATE events e
           SET title=$1, description=$2, start_at=$3, end_at=$4,
               start_date=$5, end_date=$6, all_day=true, location=$7,
               recurrence='none', updated_at=now()
           FROM trip_links tl
           WHERE tl.trip_id=$8
             AND tl.entity_type='event'
             AND tl.entity_id=e.id
             AND tl.managed_by_trip=true
             AND e.couple_id=$9
           RETURNING e.id\`,
          [String(trip.title), String(trip.notes ?? ''), targetAt, endAt, startDate, endDate, String(trip.destination ?? ''), id, coupleId],
        );
        eventIds = eventResult.rows.map((row) => String(row.id));
      } else {
        const countdownResult = await client.query(
          \`UPDATE countdowns c
           SET title=$1, updated_at=now()
           FROM trip_links tl
           WHERE tl.trip_id=$2
             AND tl.entity_type='countdown'
             AND tl.entity_id=c.id
             AND tl.managed_by_trip=true
             AND c.couple_id=$3
           RETURNING c.id\`,
          [\`\${String(trip.title)} begins\`, id, coupleId],
        );
        countdownIds = countdownResult.rows.map((row) => String(row.id));

        const eventResult = await client.query(
          \`UPDATE events e
           SET title=$1, description=$2, location=$3, updated_at=now()
           FROM trip_links tl
           WHERE tl.trip_id=$4
             AND tl.entity_type='event'
             AND tl.entity_id=e.id
             AND tl.managed_by_trip=true
             AND e.couple_id=$5
           RETURNING e.id\`,
          [String(trip.title), String(trip.notes ?? ''), String(trip.destination ?? ''), id, coupleId],
        );
        eventIds = eventResult.rows.map((row) => String(row.id));
      }

      await client.query('COMMIT');
      await setTags(coupleId, 'trip', id, body.tagIds);

      broadcast(realtime, coupleId, 'trips', 'updated', id);
      countdownIds.forEach((entityId) => broadcast(realtime, coupleId, 'countdowns', 'updated', entityId));
      eventIds.forEach((entityId) => broadcast(realtime, coupleId, 'events', 'updated', entityId));
      return reply.send({ trip, synced: { countdowns: countdownIds.length, events: eventIds.length } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally {
      client.release();
    }
  });

`,
  'trip edits sync managed planning items'
);

// ------------------------------------------------------------
// FINAL STATIC AUDIT
// ------------------------------------------------------------
const checks = [
  ['server/migrations/014_trip_goal_integrity.sql', 'managed_by_trip boolean'],
  ['server/migrations/014_trip_goal_integrity.sql', 'Imported previous total'],
  ['server/src/routes/planning.ts', 'Goal progress is history-backed'],
  ['server/src/routes/planning.ts', 'tl.managed_by_trip=true'],
  ['server/src/routes/planning.ts', "broadcast(realtime, coupleId, 'countdowns', 'updated'"],
  ['src/services/backend/mvpFeatures.ts', 'managedByTrip = false'],
  ['src/app/features/trip-detail.tsx', 'SYNCED TO TRIP'],
  ['src/app/features/goals.tsx', 'Progress is changed through Add progress'],
  ['src/types/database.ts', 'managed_by_trip: boolean'],
];
const missing = checks
  .filter(([rel, marker]) => !read(rel).includes(marker))
  .map(([rel, marker]) => `${rel}: missing ${marker}`);

if (missing.length) {
  fs.writeFileSync(p('RELEASE_C2_TRIP_GOAL_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.error(`C2 audit found ${missing.length} issue(s). See RELEASE_C2_TRIP_GOAL_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_C2_TRIP_GOAL_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('C2 Trip/Goal integrity audit clean.');
}

console.log('');
console.log('Release C2 applied.');
console.log('IMPORTANT: this release includes migration 014.');
console.log('Run:');
console.log('  npm.cmd run backend:migrate');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
