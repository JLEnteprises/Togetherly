import { apiRequest } from './api';
export type DateProposal = { id: string; proposer_id: string; title: string; start_at: string; end_at: string; status: 'pending' | 'accepted' | 'declined' | 'cancelled'; revision: number; event_id: string | null; source_activity_id: string | null; replaces_event_id: string | null };
export type PlanInput = { title: string; startAt: string; endAt: string };
export type TimeCapsule = { id: string; creator_id: string; title: string; opens_at: string; opened: boolean; opened_by_me: boolean; responses: Array<{user_id:string;body:string}>; body: string | null; photo_url: string | null };
export type Reflection = { user_id: string; body: string; updated_at: string };
export async function getDateProposals() { return (await apiRequest<{ proposals: DateProposal[] }>('/date-proposals')).proposals; }
export async function proposeDate(input: PlanInput & { id: string; sourceActivityId?: string | null; replacesEventId?: string | null }) { return (await apiRequest<{ proposal: DateProposal }>('/date-proposals', { method: 'POST', body: input })).proposal; }
export async function respondToDate(id: string, revision: number, action: 'accept' | 'decline' | 'cancel' | 'counter', input?: PlanInput) { return (await apiRequest<{ proposal: DateProposal }>(`/date-proposals/${id}/respond`, { method: 'POST', body: { action, revision, ...input } })).proposal; }
export async function getCapsules(summary = false) { return (await apiRequest<{ capsules: TimeCapsule[] }>(summary ? '/time-capsules?summary=true' : '/time-capsules', { cache: false })).capsules; }
export async function createCapsule(input: { id: string; title: string; body: string; photoUrl: string | null; opensAt: string }) { return (await apiRequest<{ capsule: TimeCapsule }>('/time-capsules', { method: 'POST', body: input })).capsule; }
export function deleteCapsule(id: string) { return apiRequest<void>(`/time-capsules/${id}`, { method: 'DELETE' }); }
export async function getReflections(id: string) { return (await apiRequest<{ reflections: Reflection[] }>(`/memories/${id}/reflections`)).reflections; }
export function saveReflection(id: string, body: string) { return apiRequest(`/memories/${id}/reflections`, { method: 'PUT', body: { body } }); }

export async function openCapsule(id: string) { return (await apiRequest<{capsule:TimeCapsule}>(`/time-capsules/${id}/open`, {method:'POST'})).capsule; }
export function respondToCapsule(id: string, body: string) { return apiRequest(`/time-capsules/${id}/reaction`, {method:'PUT',body:{body}}); }
