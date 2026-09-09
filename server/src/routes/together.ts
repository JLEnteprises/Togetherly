import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { dateKeyInTimeZone } from '../utils/sharedDay.js';
import { broadcast, notifyPartner, numberOrNull, oneOf, optionalText, requiredText, requireCoupleId, setTags, tagsSql, validateTagIds } from './helpers.js';

const activityStatuses = ['want_to_do', 'planned', 'completed', 'do_again', 'skip'] as const;
const costLevels = ['free', 'cheap', 'moderate', 'expensive'] as const;
const locations = ['home', 'nearby', 'online', 'anywhere'] as const;
const environments = ['indoor', 'outdoor', 'either'] as const;
const times = ['morning', 'day', 'night', 'any'] as const;
const moods = ['relaxing', 'romantic', 'adventurous', 'active', 'lazy', 'silly', 'any'] as const;
const questionCategories = ['cute','funny','deep','romantic','memories','childhood','future','relationship','hypothetical','would_you_rather','intimacy'] as const;

async function loadTodaysQuestion(coupleId: string) {
  const coupleResult = await pool.query('SELECT disabled_question_categories,shared_day_timezone FROM couples WHERE id=$1', [coupleId]);
  const disabledCategories = Array.isArray(coupleResult.rows[0]?.disabled_question_categories)
    ? coupleResult.rows[0].disabled_question_categories as string[]
    : [];
  const dayTimeZone = String(coupleResult.rows[0]?.shared_day_timezone || 'UTC');
  const questions = await pool.query(
    'SELECT id,question,category FROM questions WHERE enabled=true AND NOT(category = ANY($1::text[])) ORDER BY id',
    [disabledCategories],
  );
  const today = dateKeyInTimeZone(dayTimeZone);
  if (!questions.rowCount) return { question: null, today, dayTimeZone, disabledCategories };
  const dayNumber = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  return { question: questions.rows[dayNumber % questions.rows.length], today, dayTimeZone, disabledCategories };
}

function activitySelect() {
  return `SELECT a.*, ${tagsSql('a', 'activity')},
    COALESCE((SELECT json_object_agg(ai.user_id::text, ai.interested) FROM activity_interests ai WHERE ai.activity_id=a.id), '{}'::json) AS interests
    FROM activities a`;
}

export async function registerTogetherRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/activities', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(`${activitySelect()} WHERE a.couple_id=$1 ORDER BY (a.status='skip') ASC, a.updated_at DESC`, [coupleId]);
      return reply.send({ activities: result.rows });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/activities', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const id = randomUUID();
      const duration = numberOrNull(body.durationMinutes, 'Duration', 1, 1440);
      const rating = numberOrNull(body.rating, 'Rating', 1, 5);
      const result = await pool.query(
        `INSERT INTO activities(id,couple_id,creator_id,title,description,cost_level,duration_minutes,location_type,location,environment,time_of_day,mood,status,kid_friendly,booking_required,rating)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [id, coupleId, request.userId, requiredText(body.title, 'Activity title', 180), optionalText(body.description, 5000),
          oneOf(body.costLevel, costLevels, 'free'), duration == null ? null : Math.round(duration), oneOf(body.locationType, locations, 'anywhere'), optionalText(body.location, 300),
          oneOf(body.environment, environments, 'either'), oneOf(body.timeOfDay, times, 'any'), oneOf(body.mood, moods, 'any'), oneOf(body.status, activityStatuses, 'want_to_do'),
          body.kidFriendly === true, body.bookingRequired === true, rating == null ? null : Math.round(rating)],
      );
      await setTags(coupleId, 'activity', id, body.tagIds);
      await pool.query('INSERT INTO activity_interests(activity_id,user_id,interested) VALUES($1,$2,true) ON CONFLICT DO NOTHING', [id, request.userId]);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'activity', entityId: id, title: 'New date idea', body: String(result.rows[0].title) });
      broadcast(realtime, coupleId, 'activities', 'created', id);
      return reply.code(201).send({ activity: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/activities/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const currentResult = await pool.query('SELECT * FROM activities WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Activity not found.');
      const duration = body.durationMinutes === undefined ? current.duration_minutes : numberOrNull(body.durationMinutes, 'Duration', 1, 1440);
      const rating = body.rating === undefined ? current.rating : numberOrNull(body.rating, 'Rating', 1, 5);
      const status = body.status === undefined ? current.status : oneOf(body.status, activityStatuses, current.status);
      const result = await pool.query(
        `UPDATE activities SET title=$1,description=$2,cost_level=$3,duration_minutes=$4,location_type=$5,location=$6,environment=$7,time_of_day=$8,mood=$9,status=$10,
          kid_friendly=$11,booking_required=$12,rating=$13,last_completed_at=CASE WHEN $10 IN ('completed','do_again') THEN COALESCE(last_completed_at,now()) ELSE last_completed_at END,updated_at=now()
         WHERE id=$14 AND couple_id=$15 RETURNING *`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Activity title', 180),
          body.description === undefined ? current.description : optionalText(body.description, 5000), body.costLevel === undefined ? current.cost_level : oneOf(body.costLevel, costLevels, current.cost_level),
          duration == null ? null : Math.round(Number(duration)), body.locationType === undefined ? current.location_type : oneOf(body.locationType, locations, current.location_type),
          body.location === undefined ? current.location : optionalText(body.location, 300), body.environment === undefined ? current.environment : oneOf(body.environment, environments, current.environment),
          body.timeOfDay === undefined ? current.time_of_day : oneOf(body.timeOfDay, times, current.time_of_day), body.mood === undefined ? current.mood : oneOf(body.mood, moods, current.mood), status,
          body.kidFriendly === undefined ? current.kid_friendly : body.kidFriendly === true, body.bookingRequired === undefined ? current.booking_required : body.bookingRequired === true,
          rating == null ? null : Math.round(Number(rating)), id, coupleId],
      );
      await setTags(coupleId, 'activity', id, body.tagIds);
      broadcast(realtime, coupleId, 'activities', 'updated', id);
      return reply.send({ activity: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/activities/:id/interest', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const exists = await pool.query('SELECT id FROM activities WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!exists.rowCount) throw new ApiError(404, 'Activity not found.');
      const body = request.body as Record<string, unknown>;
      const interested = body.interested !== false;
      await pool.query(`INSERT INTO activity_interests(activity_id,user_id,interested) VALUES($1,$2,$3)
        ON CONFLICT(activity_id,user_id) DO UPDATE SET interested=EXCLUDED.interested,updated_at=now()`, [id, request.userId, interested]);
      broadcast(realtime, coupleId, 'activities', 'interest', id);
      return reply.send({ interested });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/activities/:id/favourite', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const favourite = body.favourite === true;
      const result = await pool.query(
        'UPDATE activities SET is_favourite=$1,updated_at=now() WHERE id=$2 AND couple_id=$3 RETURNING *',
        [favourite, id, coupleId],
      );
      if (!result.rowCount) throw new ApiError(404, 'Activity not found.');
      broadcast(realtime, coupleId, 'activities', 'favourite', id);
      return reply.send({ activity: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/activities/:id/reject', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query(`UPDATE activities SET last_rejected_at=now(),updated_at=now() WHERE id=$1 AND couple_id=$2 RETURNING *`, [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Activity not found.');
      broadcast(realtime, coupleId, 'activities', 'rejected', id);
      return reply.send({ activity: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/activities/random', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const query = request.query as Record<string, string | undefined>;
      const cost = query.cost && costLevels.includes(query.cost as typeof costLevels[number]) ? query.cost : null;
      const locationType = query.locationType && locations.includes(query.locationType as typeof locations[number]) ? query.locationType : null;
      const environment = query.environment && environments.includes(query.environment as typeof environments[number]) ? query.environment : null;
      const mood = query.mood && moods.includes(query.mood as typeof moods[number]) ? query.mood : null;
      const timeOfDay = query.timeOfDay && times.includes(query.timeOfDay as typeof times[number]) ? query.timeOfDay : null;
      const maxMinutes = query.maxMinutes ? Number(query.maxMinutes) : null;
      const kidFriendly = query.kidFriendly === 'true' ? true : null;
      const rawTagIds = query.tagIds?.trim() ? query.tagIds.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 12) : [];
      if (rawTagIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) throw new ApiError(400, 'One or more activity tags are invalid.');
      if (rawTagIds.length) {
        const validTags = await pool.query('SELECT id FROM tags WHERE couple_id=$1 AND id=ANY($2::uuid[])', [coupleId, rawTagIds]);
        if ((validTags.rowCount ?? 0) !== new Set(rawTagIds).size) throw new ApiError(400, 'One or more activity tags do not belong to this couple.');
      }
      const tagIds = rawTagIds.length ? [...new Set(rawTagIds)] : null;
      const result = await pool.query(
        `${activitySelect()} WHERE a.couple_id=$1 AND a.status IN ('want_to_do','planned','do_again')
          AND ($2::text IS NULL OR a.cost_level=$2)
          AND ($3::text IS NULL OR a.location_type=$3 OR a.location_type='anywhere')
          AND ($4::text IS NULL OR a.environment=$4 OR a.environment='either')
          AND ($5::text IS NULL OR a.mood=$5 OR a.mood='any')
          AND ($6::int IS NULL OR a.duration_minutes IS NULL OR a.duration_minutes <= $6)
          AND ($7::boolean IS NULL OR a.kid_friendly=$7)
          AND ($8::text IS NULL OR a.time_of_day=$8 OR a.time_of_day='any')
          AND ($9::uuid[] IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest($9::uuid[]) wanted(tag_id)
            WHERE NOT EXISTS (SELECT 1 FROM content_tags ct WHERE ct.entity_type='activity' AND ct.entity_id=a.id AND ct.tag_id=wanted.tag_id)
          ))
          AND (a.last_rejected_at IS NULL OR a.last_rejected_at < now() - interval '7 days')
         ORDER BY random() LIMIT 1`, [coupleId, cost, locationType, environment, mood, Number.isFinite(maxMinutes) ? maxMinutes : null, kidFriendly, timeOfDay, tagIds]);
      return reply.send({ activity: result.rows[0] ?? null });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/activities/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query('DELETE FROM activities WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Activity not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='activity' AND entity_id=$1", [id]);
      broadcast(realtime, coupleId, 'activities', 'deleted', id);
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/daily-question', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { question, today, dayTimeZone, disabledCategories } = await loadTodaysQuestion(coupleId);
      if (!question) return reply.send({ question: null, date: today, dayTimeZone, myAnswer: null, partnerAnswer: null, bothAnswered: false, revealed: false, revealedAt: null, disabledCategories });
      const answers = await pool.query('SELECT qa.*, u.display_name FROM question_answers qa JOIN users u ON u.id=qa.user_id WHERE qa.question_id=$1 AND qa.couple_id=$2 AND qa.answer_date=$3', [question.id, coupleId, today]);
      const mine = answers.rows.find((row) => String(row.user_id) === request.userId) ?? null;
      const partner = answers.rows.find((row) => String(row.user_id) !== request.userId) ?? null;
      const memberCount = await pool.query('SELECT count(*)::int AS count FROM couple_members WHERE couple_id=$1', [coupleId]);
      const bothAnswered = Number(memberCount.rows[0]?.count ?? 0) >= 2 && Boolean(mine && partner);
      const reveal = bothAnswered ? await pool.query(
        'SELECT revealed_at FROM daily_question_reveals WHERE couple_id=$1 AND question_id=$2 AND answer_date=$3 AND user_id=$4 LIMIT 1',
        [coupleId, question.id, today, request.userId],
      ) : { rows: [] as Record<string, unknown>[] };
      return reply.send({
        question,
        date: today,
        dayTimeZone,
        myAnswer: mine,
        partnerAnswer: bothAnswered ? partner : null,
        bothAnswered,
        revealed: Boolean(reveal.rows[0]),
        revealedAt: reveal.rows[0]?.revealed_at ?? null,
        waitingForPartner: Boolean(mine && !bothAnswered),
        disabledCategories,
      });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/daily-question/history', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const query = request.query as Record<string, unknown>;
      const requested = Number(query.limit ?? 60);
      const limit = Number.isFinite(requested) ? Math.max(1, Math.min(180, Math.round(requested))) : 60;
      const result = await pool.query(
        `WITH recent_days AS (
           SELECT qa.answer_date, qa.question_id
           FROM question_answers qa
           WHERE qa.couple_id=$1 AND qa.user_id=$2
           GROUP BY qa.answer_date, qa.question_id
           ORDER BY qa.answer_date DESC
           LIMIT $3
         )
         SELECT qa.*, u.display_name, q.question, q.category
         FROM recent_days rd
         JOIN question_answers qa ON qa.couple_id=$1 AND qa.answer_date=rd.answer_date AND qa.question_id=rd.question_id
         JOIN users u ON u.id=qa.user_id
         JOIN questions q ON q.id=qa.question_id
         ORDER BY qa.answer_date DESC, qa.created_at ASC`,
        [coupleId, request.userId, limit],
      );
      const groups = new Map<string, any>();
      for (const row of result.rows) {
        const date = String(row.answer_date);
        const questionId = String(row.question_id);
        const key = `${date}:${questionId}`;
        const group = groups.get(key) ?? { date, question: { id: questionId, question: String(row.question), category: String(row.category) }, answers: [] };
        group.answers.push(row);
        groups.set(key, group);
      }
      const history = [...groups.values()].map((group) => {
        const mine = group.answers.find((answer: any) => String(answer.user_id) === request.userId) ?? null;
        const partner = group.answers.find((answer: any) => String(answer.user_id) !== request.userId) ?? null;
        const bothAnswered = Boolean(mine && partner);
        return { date: group.date, question: group.question, myAnswer: mine, partnerAnswer: bothAnswered ? partner : null, bothAnswered };
      }).filter((entry) => entry.myAnswer);
      return reply.send({ history });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/daily-question/settings', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      if (!Array.isArray(body.disabledCategories) || body.disabledCategories.some((category) => typeof category !== 'string' || !(questionCategories as readonly string[]).includes(category))) {
        throw new ApiError(400, 'Question categories are invalid.');
      }
      const disabledCategories = [...new Set(body.disabledCategories as string[])];
      if (disabledCategories.length >= questionCategories.length) throw new ApiError(400, 'Keep at least one daily-question category enabled.');
      const { today } = await loadTodaysQuestion(coupleId);
      const answeredToday = await pool.query(
        'SELECT 1 FROM question_answers WHERE couple_id=$1 AND answer_date=$2 LIMIT 1',
        [coupleId, today],
      );
      if (answeredToday.rowCount) {
        throw new ApiError(409, 'Question preferences are locked for today once either partner has answered. Change them tomorrow before either of you answers.');
      }
      await pool.query('UPDATE couples SET disabled_question_categories=$1::text[],updated_at=now() WHERE id=$2', [disabledCategories, coupleId]);
      broadcast(realtime, coupleId, 'questions', 'settings');
      return reply.send({ disabledCategories });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/daily-question/answer', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const questionId = requiredText(body.questionId, 'Question', 100);
      const { question, today } = await loadTodaysQuestion(coupleId);
      if (!question || String(question.id) !== questionId) throw new ApiError(409, 'Todayâ€™s question has changed. Refresh and answer the current question.');
      const answer = requiredText(body.answer, 'Answer', 4000);

      await client.query('BEGIN');
      // Serialize the reveal boundary for the couple so neither partner can edit after both answers exist.
      await client.query('SELECT id FROM couples WHERE id=$1 FOR UPDATE', [coupleId]);
      const existing = await client.query(
        'SELECT user_id FROM question_answers WHERE question_id=$1 AND couple_id=$2 AND answer_date=$3',
        [questionId, coupleId, today],
      );
      const hadMyAnswer = existing.rows.some((row) => String(row.user_id) === request.userId);
      const partnerHasAnswered = existing.rows.some((row) => String(row.user_id) !== request.userId);
      if (hadMyAnswer && partnerHasAnswered) throw new ApiError(409, 'Todayâ€™s answers are locked now that you have both answered.');

      const result = await client.query(
        `INSERT INTO question_answers(id,question_id,user_id,couple_id,answer,answer_date)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(question_id,user_id,answer_date) DO UPDATE SET answer=EXCLUDED.answer,updated_at=now()
         RETURNING *`, [randomUUID(), questionId, request.userId, coupleId, answer, today]);
      await client.query('COMMIT');
      if (!hadMyAnswer) {
        await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'daily_question', preference: 'notification_daily_question', entityType: 'question', entityId: questionId, title: 'Daily question answered', body: 'Your partner answered todayâ€™s question.' })
          .catch((error) => console.error('Daily-question partner notification failed:', error));
      }
      broadcast(realtime, coupleId, 'questions', 'answered', questionId);
      return reply.send({ answer: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally { client.release(); }
  });

  app.post('/daily-question/reveal', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const questionId = requiredText(body.questionId, 'Question', 100);
      const { question, today } = await loadTodaysQuestion(coupleId);
      if (!question || String(question.id) !== questionId) throw new ApiError(409, 'The daily question has changed. Refresh and try again.');

      const memberCount = await pool.query('SELECT count(*)::int AS count FROM couple_members WHERE couple_id=$1', [coupleId]);
      const answers = await pool.query(
        'SELECT count(DISTINCT user_id)::int AS count FROM question_answers WHERE couple_id=$1 AND question_id=$2 AND answer_date=$3',
        [coupleId, questionId, today],
      );
      if (Number(memberCount.rows[0]?.count ?? 0) < 2 || Number(answers.rows[0]?.count ?? 0) < 2) {
        throw new ApiError(409, 'Both of you need to answer before the reveal.');
      }

      const result = await pool.query(
        `INSERT INTO daily_question_reveals(couple_id,question_id,answer_date,user_id)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(couple_id,question_id,answer_date,user_id)
         DO UPDATE SET revealed_at=daily_question_reveals.revealed_at
         RETURNING revealed_at`,
        [coupleId, questionId, today, request.userId],
      );
      broadcast(realtime, coupleId, 'questions', 'revealed', questionId);
      return reply.send({ revealed: true, revealedAt: result.rows[0].revealed_at });
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/moods/latest', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const mine = await pool.query(
        'SELECT * FROM moods WHERE couple_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1',
        [coupleId, request.userId],
      );
      const partner = await pool.query(
        `SELECT m.*,
          EXISTS(
            SELECT 1 FROM mood_acknowledgements ma
            WHERE ma.mood_id=m.id AND ma.acknowledger_user_id=$2
          ) AS acknowledged_by_me,
          (
            SELECT ma.acknowledged_at FROM mood_acknowledgements ma
            WHERE ma.mood_id=m.id AND ma.acknowledger_user_id=$2
            LIMIT 1
          ) AS acknowledged_at
         FROM moods m
         WHERE m.couple_id=$1 AND m.user_id<>$2 AND m.visibility='shared'
         ORDER BY m.created_at DESC LIMIT 1`,
        [coupleId, request.userId],
      );
      return reply.send({ mine: mine.rows[0] ?? null, partner: partner.rows[0] ?? null });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/moods/:id/acknowledge', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const mood = await pool.query(
        `SELECT id,user_id FROM moods WHERE id=$1 AND couple_id=$2 AND user_id<>$3 AND visibility='shared' LIMIT 1`,
        [params.id, coupleId, request.userId],
      );
      if (!mood.rows[0]) throw new ApiError(404, 'That shared check-in is no longer available.');

      const inserted = await pool.query(
        `INSERT INTO mood_acknowledgements(mood_id,acknowledger_user_id)
         VALUES($1,$2)
         ON CONFLICT(mood_id,acknowledger_user_id) DO NOTHING
         RETURNING acknowledged_at`,
        [params.id, request.userId],
      );
      if (inserted.rowCount) {
        await notifyPartner({
          coupleId,
          actorUserId: request.userId,
          kind: 'mood',
          preference: 'notification_partner_mood',
          entityType: 'mood',
          entityId: params.id,
          title: 'I’m here for you',
          body: 'Your partner saw your check-in and sent some support.',
        });
        broadcast(realtime, coupleId, 'moods', 'acknowledged', params.id);
      }
      return reply.send({ ok: true, acknowledgedAt: inserted.rows[0]?.acknowledged_at ?? null });
    } catch (error) { return sendError(reply, error); }
  });

  app.post('/moods', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const mood = oneOf(body.mood, ['amazing','good','okay','low','frustrated','overwhelmed','tired','stressed'] as const, 'okay');
      const need = oneOf(body.need, ['affection','reassurance','advice','listen','distraction','space','call','nothing'] as const, 'nothing');
      const visibility = oneOf(body.visibility, ['shared','private'] as const, 'shared');
      const result = await pool.query('INSERT INTO moods(id,user_id,couple_id,mood,need,visibility) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [randomUUID(), request.userId, coupleId, mood, need, visibility]);
      if (visibility === 'shared') {
        await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'mood', preference: 'notification_partner_mood', entityType: 'mood', entityId: result.rows[0].id, title: 'Partner check-in', body: `${mood} Â· ${need}` });
        broadcast(realtime, coupleId, 'moods', 'created', result.rows[0].id);
      }
      return reply.code(201).send({ mood: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });
}
