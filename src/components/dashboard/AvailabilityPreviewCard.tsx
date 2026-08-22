import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { getAvailabilityOverlaps } from '@/services/backend/availability';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import type { AvailabilityOverlap } from '@/types/database';

export function AvailabilityPreviewCard() {
  const { profile, partnerProfile } = useWorkspace(); const [slot, setSlot] = useState<AvailabilityOverlap | null>(null); const [reason, setReason] = useState('');
  const refresh = useCallback(async () => { try { const result = await getAvailabilityOverlaps(14, 30); setSlot(result.overlaps[0] ?? null); setReason(result.reason ?? ''); } catch { setSlot(null); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('schedules', refresh);
  const formatStart = (iso: string, timezone?: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(iso));
  const formatEnd = (iso: string, timezone?: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(iso));
  return <Card participantColor="both" style={{ gap: 10 }}><AppText variant="caption" tone="secondary">FREE TOGETHER</AppText>{slot ? <><AppText variant="section">{Math.floor(slot.durationMinutes / 60)}h {slot.durationMinutes % 60 ? `${slot.durationMinutes % 60}m` : ''} overlap</AppText><AppText variant="bodySmall" tone="secondary">{profile?.display_name}: {formatStart(slot.startAt, profile?.timezone)} – {formatEnd(slot.endAt, profile?.timezone)}</AppText>{partnerProfile ? <AppText variant="bodySmall" tone="secondary">{partnerProfile.display_name}: {formatStart(slot.startAt, partnerProfile.timezone)} – {formatEnd(slot.endAt, partnerProfile.timezone)}</AppText> : null}</> : <><AppText variant="cardTitle">Add your free windows</AppText><AppText variant="bodySmall" tone="secondary">{reason || 'Togetherly can find your next good call window once both schedules have Free time.'}</AppText></>}<AppButton compact variant="ghost" label="Schedules & overlap" onPress={() => router.push('/features/availability' as never)} /></Card>;
}
