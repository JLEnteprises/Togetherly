import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { RealtimeHub } from '../realtime/hub.js';
import { pool } from '../db/pool.js';
import { authenticate } from '../auth/middleware.js';
import { ApiError, sendError } from '../utils/http.js';
import { notifyPartner, setTags, tagsSql, validateTagIds } from './helpers.js';

async function requireCoupleId(userId: string) {
  const result = await pool.query('SELECT couple_id FROM couple_members WHERE user_id = $1', [userId]);
  const coupleId = result.rows[0]?.couple_id ? String(result.rows[0].couple_id) : null;
  if (!coupleId) throw new ApiError(403, 'This account is not linked to a couple.');
  return coupleId;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, `${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new ApiError(400, `${label} is too long.`);
  return trimmed;
}

function optionalText(value: unknown, maxLength: number) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new ApiError(400, 'Expected text.');
  if (value.length > maxLength) throw new ApiError(400, 'Text is too long.');
  return value;
}

function dateTimeOrNull(value: unknown, label: string) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, `${label} must be a date.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new ApiError(400, `${label} is not a valid date.`);
  return parsed.toISOString();
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

async function resolveAssignee(coupleId: string, userId: string, value: unknown) {
  const assignee = oneOf(value, ['me', 'partner', 'both'] as const, 'both');
  if (assignee === 'both') return { assigneeId: null, assignToBoth: true };
  if (assignee === 'me') return { assigneeId: userId, assignToBoth: false };
  const result = await pool.query(
    `SELECT user_id FROM couple_members WHERE couple_id = $1 AND user_id <> $2 LIMIT 1`,
    [coupleId, userId],
  );
  if (!result.rows[0]?.user_id) throw new ApiError(400, 'Link your partner before assigning a task to them.');
  return { assigneeId: String(result.rows[0].user_id), assignToBoth: false };
}

function parsedDateKey(value: string, label = 'Date') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ApiError(400, `${label} must use YYYY-MM-DD.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new ApiError(400, `${label} is not valid.`);
  return { year, month, day };
}

function dateOnlyValue(value: unknown, label: string) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, `${label} must use YYYY-MM-DD.`);
  parsedDateKey(value, label);
  return value;
}

function positiveMinutes(value: unknown, label: string) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5_256_000) throw new ApiError(400, `${label} must be between 1 minute and 10 years.`);
  return number;
}

function nextTaskDate(dateKey: string, recurrence: string) {
  const { year, month, day } = parsedDateKey(dateKey, 'Due date');
  const base = new Date(Date.UTC(year, month - 1, day));
  if (recurrence === 'daily') base.setUTCDate(base.getUTCDate() + 1);
  else if (recurrence === 'weekly') base.setUTCDate(base.getUTCDate() + 7);
  else if (recurrence === 'fortnightly') base.setUTCDate(base.getUTCDate() + 14);
  else if (recurrence === 'monthly') {
    const targetMonth = month; // zero-based target after advancing one month
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    base.setUTCFullYear(targetYear, normalizedMonth, Math.min(day, lastDay));
  } else if (recurrence === 'yearly') {
    const targetYear = year + 1;
    const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
    base.setUTCFullYear(targetYear, month - 1, Math.min(day, lastDay));
  }
  return base.toISOString().slice(0, 10);
}

function shiftIsoByDateKeys(iso: string, fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  const original = new Date(iso);
  return new Date(original.getTime() + (to - from)).toISOString();
}

function broadcast(realtime: RealtimeHub, coupleId: string, resource: string, action: string, id?: string) {
  realtime.broadcastCouple(coupleId, { type: 'feature.updated', resource, action, id });
}

export async function registerCoreFeatureRoutes(app: FastifyInstance, realtime: RealtimeHub) {
  app.get('/tasks', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT t.*, u.display_name AS assignee_name, ${tagsSql('t', 'task')},
          COALESCE((SELECT json_agg(json_build_object(
            'id', st.id, 'task_id', st.task_id, 'creator_id', st.creator_id,
            'title', st.title, 'completed', st.completed, 'due_date', st.due_date, 'estimated_minutes', st.estimated_minutes, 'sort_order', st.sort_order,
            'created_at', st.created_at, 'updated_at', st.updated_at
          ) ORDER BY st.sort_order, st.created_at)
          FROM task_subtasks st WHERE st.task_id = t.id), '[]'::json) AS subtasks
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.couple_id = $1
         ORDER BY (t.status = 'completed') ASC, t.due_date ASC NULLS LAST, t.created_at DESC`,
        [coupleId],
      );
      return reply.send({ tasks: result.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/tasks', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const title = requiredText(body.title, 'Task title', 200);
      const description = optionalText(body.description, 4000);
      const dueAt = dateTimeOrNull(body.dueAt, 'Due date');
      const dueDate = dateOnlyValue(body.dueDate, 'Due date');
      const startDate = dateOnlyValue(body.startDate, 'Start date');
      const estimatedMinutes = positiveMinutes(body.estimatedMinutes, 'Estimated duration');
      if (startDate && dueDate && startDate > dueDate) throw new ApiError(400, 'Start date cannot be after the due date.');
      const priority = oneOf(body.priority, ['low', 'normal', 'high'] as const, 'normal');
      const recurrence = oneOf(body.recurrence, ['none', 'daily', 'weekly', 'fortnightly', 'monthly', 'yearly'] as const, 'none');
      if (recurrence !== 'none' && !dueDate) throw new ApiError(400, 'Choose a due date for a repeating task.');
      if (body.subtasks !== undefined && !Array.isArray(body.subtasks)) throw new ApiError(400, 'Checklist steps are invalid.');
      const subtasks = (Array.isArray(body.subtasks) ? body.subtasks : []).slice(0, 50).map((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, `Checklist step ${index + 1} is invalid.`);
        const step = value as Record<string, unknown>;
        const stepDueDate = dateOnlyValue(step.dueDate, 'Step due date');
        if (stepDueDate && dueDate && stepDueDate > dueDate) throw new ApiError(400, 'A checklist step cannot be due after the task.');
        return { title: requiredText(step.title, 'Subtask', 300), dueDate: stepDueDate, estimatedMinutes: positiveMinutes(step.estimatedMinutes, 'Step duration') };
      });
      const { assigneeId, assignToBoth } = await resolveAssignee(coupleId, request.userId, body.assignee);
      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO tasks(id, couple_id, creator_id, assignee_id, assign_to_both, title, description, due_at, due_date, start_date, estimated_minutes, priority, recurrence, series_id)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [id, coupleId, request.userId, assigneeId, assignToBoth, title, description, dueAt, dueDate, startDate, estimatedMinutes, priority, recurrence, recurrence === 'none' ? null : id],
      );
      await setTags(coupleId, 'task', id, body.tagIds);
      for (let index = 0; index < subtasks.length; index += 1) {
        const step = subtasks[index]!;
        await pool.query(
          `INSERT INTO task_subtasks(id,task_id,creator_id,title,due_date,estimated_minutes,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [randomUUID(), id, request.userId, step.title, step.dueDate, step.estimatedMinutes, index],
        );
      }
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'task', preference: 'notification_tasks', entityType: 'task', entityId: id, title: 'New shared task', body: title });
      broadcast(realtime, coupleId, 'tasks', 'created', id);
      return reply.code(201).send({ task: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/tasks/:id', { preHandler: authenticate }, async (request, reply) => {
    const client = await pool.connect();
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      await client.query('BEGIN');
      const current = await client.query('SELECT * FROM tasks WHERE id = $1 AND couple_id = $2 FOR UPDATE', [params.id, coupleId]);
      if (!current.rows[0]) throw new ApiError(404, 'Task not found.');
      const task = current.rows[0];
      if (body.updatedAt !== undefined) {
        if (typeof body.updatedAt !== 'string' || !Number.isFinite(new Date(body.updatedAt).getTime())) throw new ApiError(400, 'Task version is invalid.');
        if (new Date(task.updated_at).getTime() !== new Date(body.updatedAt).getTime()) throw new ApiError(409, 'This task changed after you opened it. Refresh before saving so your partner’s changes are not overwritten.');
      }
      const title = body.title === undefined ? task.title : requiredText(body.title, 'Task title', 200);
      const description = body.description === undefined ? task.description : optionalText(body.description, 4000);
      const dueAt = body.dueAt === undefined ? task.due_at : dateTimeOrNull(body.dueAt, 'Due date');
      const dueDate = body.dueDate === undefined ? task.due_date : dateOnlyValue(body.dueDate, 'Due date');
      const startDate = body.startDate === undefined ? task.start_date : dateOnlyValue(body.startDate, 'Start date');
      const estimatedMinutes = body.estimatedMinutes === undefined ? task.estimated_minutes : positiveMinutes(body.estimatedMinutes, 'Estimated duration');
      if (startDate && dueDate && String(startDate) > String(dueDate)) throw new ApiError(400, 'Start date cannot be after the due date.');
      const priority = body.priority === undefined ? task.priority : oneOf(body.priority, ['low', 'normal', 'high'] as const, task.priority);
      const status = body.status === undefined ? task.status : oneOf(body.status, ['not_started', 'in_progress', 'completed', 'skipped'] as const, task.status);
      const recurrence = body.recurrence === undefined ? task.recurrence : oneOf(body.recurrence, ['none', 'daily', 'weekly', 'fortnightly', 'monthly', 'yearly'] as const, task.recurrence);
      if (recurrence !== 'none' && !dueDate) throw new ApiError(400, 'Choose a due date for a repeating task.');
      let assigneeId = task.assignee_id;
      let assignToBoth = task.assign_to_both;
      if (body.assignee !== undefined) {
        const resolved = await resolveAssignee(coupleId, request.userId, body.assignee);
        assigneeId = resolved.assigneeId;
        assignToBoth = resolved.assignToBoth;
      }
      const seriesId = recurrence === 'none' ? task.series_id : (task.series_id ?? task.id);
      const result = await client.query(
        `UPDATE tasks SET title = $1, description = $2, due_at = $3, due_date = $4, start_date = $5, estimated_minutes = $6, priority = $7, status = $8,
          assignee_id = $9, assign_to_both = $10, recurrence = $11, series_id = $12, updated_at = now()
         WHERE id = $13 AND couple_id = $14 RETURNING *`,
        [title, description, dueAt, dueDate, startDate, estimatedMinutes, priority, status, assigneeId, assignToBoth, recurrence, seriesId, params.id, coupleId],
      );

      let nextTaskId: string | null = null;
      if (task.status !== 'completed' && status === 'completed' && recurrence !== 'none' && dueDate) {
        const nextDueDate = nextTaskDate(String(dueDate), recurrence);
        const nextDueAt = dueAt ? shiftIsoByDateKeys(String(dueAt), String(dueDate), nextDueDate) : null;
        const nextStartDate = startDate ? nextTaskDate(String(startDate), recurrence) : null;
        const nextOccurrenceNumber = Number(task.occurrence_number ?? 1) + 1;
        const existingNext = await client.query(
          `SELECT id FROM tasks WHERE series_id=$1 AND occurrence_number=$2 LIMIT 1`,
          [seriesId, nextOccurrenceNumber],
        );
        if (existingNext.rows[0]?.id) {
          nextTaskId = String(existingNext.rows[0].id);
        } else {
          nextTaskId = randomUUID();
          await client.query(
            `INSERT INTO tasks(id,couple_id,creator_id,assignee_id,assign_to_both,title,description,due_at,due_date,start_date,estimated_minutes,priority,status,recurrence,series_id,occurrence_number)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'not_started',$13,$14,$15)`,
            [nextTaskId, coupleId, task.creator_id, assigneeId, assignToBoth, title, description, nextDueAt, nextDueDate, nextStartDate, estimatedMinutes, priority, recurrence, seriesId, nextOccurrenceNumber],
          );
          await client.query(
            `INSERT INTO content_tags(tag_id, entity_type, entity_id)
             SELECT tag_id, 'task', $1 FROM content_tags WHERE entity_type='task' AND entity_id=$2
             ON CONFLICT DO NOTHING`,
            [nextTaskId, params.id],
          );
          const subtaskTemplate = await client.query(
            `SELECT creator_id,title,due_date,estimated_minutes,sort_order FROM task_subtasks WHERE task_id=$1 ORDER BY sort_order, created_at`,
            [params.id],
          );
          for (const subtask of subtaskTemplate.rows) {
            await client.query(
              `INSERT INTO task_subtasks(id,task_id,creator_id,title,completed,due_date,estimated_minutes,sort_order) VALUES($1,$2,$3,$4,false,$5,$6,$7)`,
              [randomUUID(), nextTaskId, subtask.creator_id, subtask.title, subtask.due_date ? nextTaskDate(String(subtask.due_date), recurrence) : null, subtask.estimated_minutes, subtask.sort_order],
            );
          }
        }
      }
      await client.query('COMMIT');
      await setTags(coupleId, 'task', params.id, body.tagIds);
      // If this PATCH both changes tags and completes a recurring task, the new
      // occurrence should inherit the tags the user just saved rather than the
      // pre-edit tag set that existed when the transaction began.
      if (nextTaskId && body.tagIds !== undefined) await setTags(coupleId, 'task', nextTaskId, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'task', preference: 'notification_tasks', entityType: 'task', entityId: params.id, title: status === 'completed' ? 'Task completed' : 'Task updated', body: title });
      broadcast(realtime, coupleId, 'tasks', nextTaskId ? 'completed-and-repeated' : 'updated', params.id);
      return reply.send({ task: result.rows[0], nextTaskId });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return sendError(reply, error);
    } finally {
      client.release();
    }
  });

  app.delete('/tasks/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND couple_id = $2 RETURNING id', [params.id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Task not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='task' AND entity_id=$1", [params.id]);
      broadcast(realtime, coupleId, 'tasks', 'deleted', params.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/tasks/:id/subtasks', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const parent = await pool.query('SELECT id FROM tasks WHERE id=$1 AND couple_id=$2', [id, coupleId]);
      if (!parent.rowCount) throw new ApiError(404, 'Task not found.');
      const sortResult = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM task_subtasks WHERE task_id=$1', [id]);
      const result = await pool.query(
        `INSERT INTO task_subtasks(id,task_id,creator_id,title,due_date,estimated_minutes,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [randomUUID(), id, request.userId, requiredText(body.title, 'Subtask', 300), dateOnlyValue(body.dueDate, 'Step due date'), positiveMinutes(body.estimatedMinutes, 'Step duration'), Number(sortResult.rows[0]?.next ?? 0)],
      );
      broadcast(realtime, coupleId, 'tasks', 'subtask-created', id);
      return reply.code(201).send({ subtask: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.patch('/task-subtasks/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const currentResult = await pool.query(
        `SELECT st.* FROM task_subtasks st JOIN tasks t ON t.id=st.task_id WHERE st.id=$1 AND t.couple_id=$2`, [id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Subtask not found.');
      const result = await pool.query(
        `UPDATE task_subtasks SET title=$1,completed=$2,due_date=$3,estimated_minutes=$4,sort_order=$5,updated_at=now() WHERE id=$6 RETURNING *`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Subtask', 300), body.completed === undefined ? current.completed : body.completed === true,
          body.dueDate === undefined ? current.due_date : dateOnlyValue(body.dueDate, 'Step due date'),
          body.estimatedMinutes === undefined ? current.estimated_minutes : positiveMinutes(body.estimatedMinutes, 'Step duration'),
          body.sortOrder === undefined ? current.sort_order : Math.max(0, Math.floor(Number(body.sortOrder) || 0)), id],
      );
      broadcast(realtime, coupleId, 'tasks', 'subtask-updated', String(current.task_id));
      return reply.send({ subtask: result.rows[0] });
    } catch (error) { return sendError(reply, error); }
  });

  app.delete('/task-subtasks/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const { id } = request.params as { id: string };
      const result = await pool.query(
        `DELETE FROM task_subtasks st USING tasks t WHERE st.id=$1 AND t.id=st.task_id AND t.couple_id=$2 RETURNING st.task_id`, [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Subtask not found.');
      broadcast(realtime, coupleId, 'tasks', 'subtask-deleted', String(result.rows[0].task_id));
      return reply.code(204).send();
    } catch (error) { return sendError(reply, error); }
  });

  app.get('/notes', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT n.*, ${tagsSql('n', 'note')} FROM notes n
         WHERE n.couple_id = $1 AND (n.visibility = 'shared' OR n.creator_id = $2)
         ORDER BY n.pinned DESC, n.updated_at DESC`,
        [coupleId, request.userId],
      );
      return reply.send({ notes: result.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/notes', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const title = requiredText(body.title, 'Note title', 200);
      const noteBody = optionalText(body.body, 20_000);
      const visibility = oneOf(body.visibility, ['shared', 'private'] as const, 'shared');
      const pinned = body.pinned === true;
      const result = await pool.query(
        `INSERT INTO notes(id, couple_id, creator_id, title, body, visibility, pinned)
         VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [randomUUID(), coupleId, request.userId, title, noteBody, visibility, pinned],
      );
      await setTags(coupleId, 'note', result.rows[0].id, body.tagIds);
      if (visibility === 'shared') {
        await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'note', entityId: result.rows[0].id, title: 'New shared note', body: title });
        broadcast(realtime, coupleId, 'notes', 'created', result.rows[0].id);
      }
      return reply.code(201).send({ note: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/notes/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const current = await pool.query('SELECT * FROM notes WHERE id = $1 AND couple_id = $2', [params.id, coupleId]);
      const note = current.rows[0];
      if (!note || (note.visibility === 'private' && String(note.creator_id) !== request.userId)) throw new ApiError(404, 'Note not found.');
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      let expectedUpdatedAt: string | null = null;
      if (body.updatedAt !== undefined) {
        if (typeof body.updatedAt !== 'string' || !Number.isFinite(new Date(body.updatedAt).getTime())) throw new ApiError(400, 'Note version is invalid.');
        expectedUpdatedAt = new Date(body.updatedAt).toISOString();
      }
      const title = body.title === undefined ? note.title : requiredText(body.title, 'Note title', 200);
      const noteBody = body.body === undefined ? note.body : optionalText(body.body, 20_000);
      const visibility = body.visibility === undefined ? note.visibility : oneOf(body.visibility, ['shared', 'private'] as const, note.visibility);
      if (note.visibility === 'shared' && visibility === 'private' && String(note.creator_id) !== request.userId) {
        throw new ApiError(403, 'Only the note creator can make a shared note private.');
      }
      const pinned = body.pinned === undefined ? note.pinned : body.pinned === true;
      const result = await pool.query(
        `UPDATE notes SET title = $1, body = $2, visibility = $3, pinned = $4, updated_at = now()
         WHERE id = $5 AND couple_id = $6 AND ($7::timestamptz IS NULL OR updated_at = $7::timestamptz) RETURNING *`,
        [title, noteBody, visibility, pinned, params.id, coupleId, expectedUpdatedAt],
      );
      if (!result.rowCount) throw new ApiError(409, 'This note changed after you opened it. Refresh before saving so your partner’s changes are not overwritten.');
      await setTags(coupleId, 'note', params.id, body.tagIds);
      if (note.visibility === 'shared' || visibility === 'shared') broadcast(realtime, coupleId, 'notes', 'updated', params.id);
      return reply.send({ note: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/notes/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const result = await pool.query(
        `DELETE FROM notes WHERE id = $1 AND couple_id = $2
         AND (visibility = 'shared' OR creator_id = $3)
         RETURNING id, visibility`,
        [params.id, coupleId, request.userId],
      );
      if (!result.rowCount) throw new ApiError(404, 'Note not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='note' AND entity_id=$1", [params.id]);
      if (result.rows[0].visibility === 'shared') broadcast(realtime, coupleId, 'notes', 'deleted', params.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/lists', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query(
        `SELECT l.*, count(li.id)::int AS item_count,
          count(li.id) FILTER (WHERE li.completed)::int AS completed_count, ${tagsSql('l', 'list')}
         FROM lists l LEFT JOIN list_items li ON li.list_id = l.id
         WHERE l.couple_id = $1
         GROUP BY l.id
         ORDER BY l.updated_at DESC`,
        [coupleId],
      );
      return reply.send({ lists: result.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/lists', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const title = requiredText(body.title, 'List title', 120);
      const result = await pool.query(
        'INSERT INTO lists(id, couple_id, creator_id, title) VALUES($1, $2, $3, $4) RETURNING *',
        [randomUUID(), coupleId, request.userId, title],
      );
      await setTags(coupleId, 'list', result.rows[0].id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'list', entityId: result.rows[0].id, title: 'New shared list', body: title });
      broadcast(realtime, coupleId, 'lists', 'created', result.rows[0].id);
      return reply.code(201).send({ list: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/lists/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      await validateTagIds(coupleId, body.tagIds);
      const current = await pool.query('SELECT * FROM lists WHERE id = $1 AND couple_id = $2', [params.id, coupleId]);
      const list = current.rows[0];
      if (!list) throw new ApiError(404, 'List not found.');
      const title = body.title === undefined ? list.title : requiredText(body.title, 'List title', 120);
      const result = await pool.query(
        'UPDATE lists SET title = $1, updated_at = now() WHERE id = $2 AND couple_id = $3 RETURNING *',
        [title, params.id, coupleId],
      );
      await setTags(coupleId, 'list', params.id, body.tagIds);
      broadcast(realtime, coupleId, 'lists', 'updated', params.id);
      return reply.send({ list: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/lists/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const listResult = await pool.query(`SELECT l.*, ${tagsSql('l', 'list')} FROM lists l WHERE l.id = $1 AND l.couple_id = $2`, [params.id, coupleId]);
      if (!listResult.rows[0]) throw new ApiError(404, 'List not found.');
      const itemsResult = await pool.query('SELECT * FROM list_items WHERE list_id = $1 ORDER BY completed ASC, created_at ASC', [params.id]);
      return reply.send({ list: listResult.rows[0], items: itemsResult.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/lists/:id/items', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const listResult = await pool.query('SELECT id FROM lists WHERE id = $1 AND couple_id = $2', [params.id, coupleId]);
      if (!listResult.rowCount) throw new ApiError(404, 'List not found.');
      const body = request.body as Record<string, unknown>;
      const title = requiredText(body.title, 'List item', 300);
      const notes = optionalText(body.notes, 4000);
      const link = body.link == null || body.link === '' ? null : requiredText(body.link, 'Link', 2000);
      if (link && !/^https?:\/\//i.test(link)) throw new ApiError(400, 'List item link must start with http:// or https://.');
      const priority = oneOf(body.priority, ['low', 'normal', 'high'] as const, 'normal');
      const result = await pool.query(
        `INSERT INTO list_items(id, list_id, creator_id, title, notes, link, priority)
         VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [randomUUID(), params.id, request.userId, title, notes, link, priority],
      );
      await pool.query('UPDATE lists SET updated_at = now() WHERE id = $1', [params.id]);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'partner_activity', preference: 'notification_partner_activity', entityType: 'list', entityId: params.id, title: 'List item added', body: title });
      broadcast(realtime, coupleId, 'lists', 'item.created', result.rows[0].id);
      return reply.code(201).send({ item: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/list-items/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const current = await pool.query(
        `SELECT li.* FROM list_items li JOIN lists l ON l.id = li.list_id
         WHERE li.id = $1 AND l.couple_id = $2`,
        [params.id, coupleId],
      );
      const item = current.rows[0];
      if (!item) throw new ApiError(404, 'List item not found.');
      const body = request.body as Record<string, unknown>;
      const title = body.title === undefined ? item.title : requiredText(body.title, 'List item', 300);
      const completed = body.completed === undefined ? item.completed : body.completed === true;
      const notes = body.notes === undefined ? item.notes : optionalText(body.notes, 4000);
      const link = body.link === undefined ? item.link : body.link == null || body.link === '' ? null : requiredText(body.link, 'Link', 2000);
      if (link && !/^https?:\/\//i.test(link)) throw new ApiError(400, 'List item link must start with http:// or https://.');
      const priority = body.priority === undefined ? item.priority : oneOf(body.priority, ['low', 'normal', 'high'] as const, item.priority);
      const result = await pool.query(
        `UPDATE list_items SET title = $1, notes = $2, link = $3, completed = $4, priority = $5, updated_at = now()
         WHERE id = $6 RETURNING *`,
        [title, notes, link, completed, priority, params.id],
      );
      await pool.query('UPDATE lists SET updated_at = now() WHERE id = $1', [item.list_id]);
      broadcast(realtime, coupleId, 'lists', 'item.updated', params.id);
      return reply.send({ item: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/list-items/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const result = await pool.query(
        `DELETE FROM list_items li USING lists l
         WHERE li.id = $1 AND li.list_id = l.id AND l.couple_id = $2
         RETURNING li.id, li.list_id`,
        [params.id, coupleId],
      );
      if (!result.rowCount) throw new ApiError(404, 'List item not found.');
      await pool.query('UPDATE lists SET updated_at = now() WHERE id = $1', [result.rows[0].list_id]);
      broadcast(realtime, coupleId, 'lists', 'item.deleted', params.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/lists/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const result = await pool.query('DELETE FROM lists WHERE id = $1 AND couple_id = $2 RETURNING id', [params.id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'List not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='list' AND entity_id=$1", [params.id]);
      await pool.query("DELETE FROM trip_links WHERE entity_type='list' AND entity_id=$1", [params.id]);
      broadcast(realtime, coupleId, 'lists', 'deleted', params.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get('/countdowns', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const result = await pool.query('SELECT * FROM countdowns WHERE couple_id = $1 ORDER BY target_at ASC', [coupleId]);
      return reply.send({ countdowns: result.rows });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post('/countdowns', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const body = request.body as Record<string, unknown>;
      const title = requiredText(body.title, 'Countdown title', 160);
      const targetAt = dateTimeOrNull(body.targetAt, 'Target date');
      if (!targetAt) throw new ApiError(400, 'Target date is required.');
      const startAt = dateTimeOrNull(body.startAt, 'Starting date');
      if (startAt && new Date(startAt).getTime() >= new Date(targetAt).getTime()) throw new ApiError(400, 'Starting date must be before the target date.');
      const type = oneOf(body.type, ['visit', 'flight', 'anniversary', 'birthday', 'moving', 'wedding', 'holiday', 'custom'] as const, 'custom');
      const result = await pool.query(
        `INSERT INTO countdowns(id, couple_id, creator_id, title, target_at, start_at, type)
         VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [randomUUID(), coupleId, request.userId, title, targetAt, startAt, type],
      );
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: type === 'visit' ? 'visit' : 'countdown', preference: type === 'visit' ? 'notification_visit_approaching' : 'notification_countdowns', entityType: 'countdown', entityId: result.rows[0].id, title: type === 'visit' ? 'Visit countdown added' : 'Countdown added', body: title });
      broadcast(realtime, coupleId, 'countdowns', 'created', result.rows[0].id);
      return reply.code(201).send({ countdown: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch('/countdowns/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const currentResult = await pool.query('SELECT * FROM countdowns WHERE id = $1 AND couple_id = $2', [params.id, coupleId]);
      const current = currentResult.rows[0];
      if (!current) throw new ApiError(404, 'Countdown not found.');
      const title = body.title === undefined ? current.title : requiredText(body.title, 'Countdown title', 160);
      const targetAt = body.targetAt === undefined ? current.target_at : dateTimeOrNull(body.targetAt, 'Target date');
      if (!targetAt) throw new ApiError(400, 'Target date is required.');
      const startAt = body.startAt === undefined ? current.start_at : dateTimeOrNull(body.startAt, 'Starting date');
      if (startAt && new Date(startAt).getTime() >= new Date(targetAt).getTime()) throw new ApiError(400, 'Starting date must be before the target date.');
      const type = body.type === undefined ? current.type : oneOf(body.type, ['visit', 'flight', 'anniversary', 'birthday', 'moving', 'wedding', 'holiday', 'custom'] as const, current.type);
      const result = await pool.query(
        `UPDATE countdowns SET title=$1,target_at=$2,start_at=$3,type=$4,updated_at=now()
         WHERE id=$5 AND couple_id=$6 RETURNING *`,
        [title, targetAt, startAt, type, params.id, coupleId],
      );
      broadcast(realtime, coupleId, 'countdowns', 'updated', params.id);
      return reply.send({ countdown: result.rows[0] });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete('/countdowns/:id', { preHandler: authenticate }, async (request, reply) => {
    try {
      const coupleId = await requireCoupleId(request.userId);
      const params = request.params as { id: string };
      const result = await pool.query('DELETE FROM countdowns WHERE id = $1 AND couple_id = $2 RETURNING id', [params.id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Countdown not found.');
      await pool.query("DELETE FROM trip_links WHERE entity_type='countdown' AND entity_id=$1", [params.id]);
      broadcast(realtime, coupleId, 'countdowns', 'deleted', params.id);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
