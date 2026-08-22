import { apiRequest } from './api';
import type {
  CoupleCountdown,
  CoupleList,
  CoupleListItem,
  CoupleNote,
  CoupleTask,
  CountdownType,
  Priority,
  TaskStatus,
  TaskRecurrence,
  TaskSubtask,
} from '@/types/database';

export async function getTasks() {
  const result = await apiRequest<{ tasks: CoupleTask[] }>('/tasks');
  return result.tasks;
}

export async function createTask(input: {
  title: string;
  description?: string;
  dueAt?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedMinutes?: number | null;
  recurrence?: TaskRecurrence;
  priority?: Priority;
  assignee?: 'me' | 'partner' | 'both';
  tagIds?: string[];
}) {
  const result = await apiRequest<{ task: CoupleTask }>('/tasks', { method: 'POST', body: input });
  return result.task;
}

export async function updateTask(id: string, input: {
  title?: string;
  description?: string;
  dueAt?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  estimatedMinutes?: number | null;
  recurrence?: TaskRecurrence;
  priority?: Priority;
  assignee?: 'me' | 'partner' | 'both';
  status?: TaskStatus;
  tagIds?: string[];
}) {
  const result = await apiRequest<{ task: CoupleTask }>(`/tasks/${id}`, { method: 'PATCH', body: input });
  return result.task;
}

export function deleteTask(id: string) {
  return apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' });
}

export async function createSubtask(taskId: string, input: { title: string; dueDate?: string | null; estimatedMinutes?: number | null }) {
  return (await apiRequest<{ subtask: TaskSubtask }>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: input })).subtask;
}
export async function updateSubtask(id: string, input: Partial<{ title: string; completed: boolean; dueDate: string | null; estimatedMinutes: number | null; sortOrder: number }>) {
  return (await apiRequest<{ subtask: TaskSubtask }>(`/task-subtasks/${id}`, { method: 'PATCH', body: input })).subtask;
}
export function deleteSubtask(id: string) { return apiRequest<void>(`/task-subtasks/${id}`, { method: 'DELETE' }); }


export async function getNotes() {
  const result = await apiRequest<{ notes: CoupleNote[] }>('/notes');
  return result.notes;
}

export async function createNote(input: { title: string; body?: string; visibility?: 'shared' | 'private'; pinned?: boolean; tagIds?: string[] }) {
  const result = await apiRequest<{ note: CoupleNote }>('/notes', { method: 'POST', body: input });
  return result.note;
}

export async function updateNote(id: string, input: Partial<Pick<CoupleNote, 'title' | 'body' | 'visibility' | 'pinned'>> & { tagIds?: string[] }) {
  const result = await apiRequest<{ note: CoupleNote }>(`/notes/${id}`, { method: 'PATCH', body: input });
  return result.note;
}

export function deleteNote(id: string) {
  return apiRequest<void>(`/notes/${id}`, { method: 'DELETE' });
}

export async function getLists() {
  const result = await apiRequest<{ lists: CoupleList[] }>('/lists');
  return result.lists;
}

export async function createList(title: string, tagIds?: string[]) {
  const result = await apiRequest<{ list: CoupleList }>('/lists', { method: 'POST', body: { title, tagIds } });
  return result.list;
}

export async function updateList(id: string, input: { title?: string; tagIds?: string[] }) {
  const result = await apiRequest<{ list: CoupleList }>(`/lists/${id}`, { method: 'PATCH', body: input });
  return result.list;
}

export async function getList(id: string) {
  return apiRequest<{ list: CoupleList; items: CoupleListItem[] }>(`/lists/${id}`);
}

export async function createListItem(listId: string, input: { title: string; notes?: string; link?: string | null; priority?: Priority }) {
  const result = await apiRequest<{ item: CoupleListItem }>(`/lists/${listId}/items`, { method: 'POST', body: input });
  return result.item;
}

export async function updateListItem(id: string, input: { title?: string; notes?: string; link?: string | null; completed?: boolean; priority?: Priority }) {
  const result = await apiRequest<{ item: CoupleListItem }>(`/list-items/${id}`, { method: 'PATCH', body: input });
  return result.item;
}

export function deleteListItem(id: string) {
  return apiRequest<void>(`/list-items/${id}`, { method: 'DELETE' });
}

export function deleteList(id: string) {
  return apiRequest<void>(`/lists/${id}`, { method: 'DELETE' });
}

export async function getCountdowns() {
  const result = await apiRequest<{ countdowns: CoupleCountdown[] }>('/countdowns');
  return result.countdowns;
}

export async function createCountdown(input: { title: string; targetAt: string; startAt?: string | null; type?: CountdownType }) {
  const result = await apiRequest<{ countdown: CoupleCountdown }>('/countdowns', { method: 'POST', body: input });
  return result.countdown;
}

export async function updateCountdown(id: string, input: Partial<{ title: string; targetAt: string; startAt: string | null; type: CountdownType }>) {
  const result = await apiRequest<{ countdown: CoupleCountdown }>(`/countdowns/${id}`, { method: 'PATCH', body: input });
  return result.countdown;
}

export function deleteCountdown(id: string) {
  return apiRequest<void>(`/countdowns/${id}`, { method: 'DELETE' });
}
