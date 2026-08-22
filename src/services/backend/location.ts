import { apiRequest } from './api';
import type { LiveLocationMember } from '@/types/database';

export function getLiveLocations() { return apiRequest<{ members: LiveLocationMember[] }>('/location'); }
export function setLocationSharing(enabled: boolean) { return apiRequest<{ ok: true; sharingEnabled: boolean }>('/location/sharing', { method: 'PUT', body: { enabled } }); }
export function sendLivePosition(input: { latitude: number; longitude: number; accuracyM?: number | null; capturedAt?: string; timezone?: string | null }) {
  return apiRequest<{ ok: true }>('/location/position', { method: 'PUT', body: input });
}
