import { apiRequest } from './api';
import type { AvailabilityOverlap, ScheduleKind, ScheduleWindow } from '@/types/database';

export async function getSchedules() {
  return (await apiRequest<{ schedules: ScheduleWindow[] }>('/schedules')).schedules;
}
export async function createSchedule(input: { label: string; kind: ScheduleKind; dayOfWeek: number; startMinute: number; endMinute: number; enabled?: boolean }) {
  return (await apiRequest<{ schedule: ScheduleWindow }>('/schedules', { method: 'POST', body: input })).schedule;
}
export async function updateSchedule(id: string, input: Partial<{ label: string; kind: ScheduleKind; dayOfWeek: number; startMinute: number; endMinute: number; enabled: boolean }>) {
  return (await apiRequest<{ schedule: ScheduleWindow }>(`/schedules/${id}`, { method: 'PATCH', body: input })).schedule;
}
export function deleteSchedule(id: string) { return apiRequest<void>(`/schedules/${id}`, { method: 'DELETE' }); }
export async function getAvailabilityOverlaps(days = 14, minMinutes = 30) {
  return apiRequest<{ overlaps: AvailabilityOverlap[]; reason?: string }>(`/availability/overlaps?days=${days}&minMinutes=${minMinutes}`);
}
