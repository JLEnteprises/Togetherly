import type { ParticipantColor, Profile, WorkspaceSnapshot } from '@/types/database';
import { apiRequest } from './api';

export function getWorkspace() { return apiRequest<WorkspaceSnapshot>('/workspace'); }

export async function createCoupleWorkspace(input: { relationshipStartDate?: string | null; longDistanceEnabled: boolean; participantColor?: ParticipantColor }) {
  return apiRequest<{ coupleId: string; inviteCode: string; participantColor: ParticipantColor }>('/workspace/create', { method: 'POST', body: input });
}

export async function joinCoupleWithCode(inviteCode: string) {
  const normalizedCode = inviteCode.trim().toUpperCase();
  if (!normalizedCode) throw new Error('Enter an invite code first.');
  return apiRequest<{ coupleId: string; participantColor: ParticipantColor }>('/workspace/join', { method: 'POST', body: { inviteCode: normalizedCode } });
}

export async function regenerateCoupleInvite() { return apiRequest<{ inviteCode: string }>('/workspace/invite/regenerate', { method: 'POST', body: {} }); }

export async function updateProfile(input: { displayName?: string; timezone?: string; timezoneMode?: 'automatic' | 'manual'; avatarUrl?: string | null; preferredColor?: ParticipantColor; onboardingComplete?: boolean }) {
  return apiRequest<{ profile: Profile }>('/workspace/profile', { method: 'PATCH', body: input });
}

export async function updateCouple(input: { relationshipStartDate?: string | null; longDistanceEnabled?: boolean }) {
  return apiRequest<{ couple: import('@/types/database').Couple }>('/workspace/couple', { method: 'PATCH', body: input });
}

export function leaveCouple() { return apiRequest<{ ok: true }>('/workspace/leave', { method: 'POST' }); }
export function removePartner() { return apiRequest<{ ok: true }>('/workspace/remove-partner', { method: 'POST' }); }
export function deleteCoupleSpace() { return apiRequest<void>('/workspace', { method: 'DELETE' }); }
