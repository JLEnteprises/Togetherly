import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { AppText } from '@/components/common/AppText';
import { getCountdowns } from '@/services/backend/coreFeatures';
import { getAvailabilityOverlaps } from '@/services/backend/availability';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { AvailabilityOverlap, CoupleCountdown } from '@/types/database';
import { useLocationSharing } from '@/providers/LocationProvider';
import { AppIcon } from '@/components/art/AppIcon';
import { countdownRemaining } from '@/utils/countdown';

function formatTime(timezone: string | undefined, date = new Date()) {
  try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone || 'UTC' }).format(date); }
  catch { return '—'; }
}
function offsetMinutes(timezone: string | undefined, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const zoned = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    return Math.round((zoned - date.getTime()) / 60_000);
  } catch { return 0; }
}
function timeDifferenceLabel(mine: string | undefined, theirs: string | undefined, date = new Date()) {
  const difference = offsetMinutes(theirs, date) - offsetMinutes(mine, date);
  if (difference === 0) return 'Same time';
  const hours = Math.abs(difference) / 60;
  const amount = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${amount}h apart`;
}
function daysUntil(value: string, now = Date.now()) { return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 86_400_000)); }
function overlapLabel(slot: AvailabilityOverlap | null, timezone: string | undefined) {
  if (!slot) return 'Add availability';
  const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(slot.startAt));
  return `${when} · ${Math.floor(slot.durationMinutes / 60)}h${slot.durationMinutes % 60 ? ` ${slot.durationMinutes % 60}m` : ''}`;
}

export function LongDistanceOverviewCard() {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  const { members } = useLocationSharing();
  const [countdown, setCountdown] = useState<CoupleCountdown | null>(null);
  const [overlap, setOverlap] = useState<AvailabilityOverlap | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const [countdownsResult, overlapResult] = await Promise.allSettled([getCountdowns(), getAvailabilityOverlaps(14, 30)]);
    if (countdownsResult.status === 'fulfilled') setCountdown(countdownsResult.value.find((item) => !countdownRemaining(item.target_at, Date.now()).passed) ?? null);
    if (overlapResult.status === 'fulfilled') setOverlap(overlapResult.value.overlaps[0] ?? null);
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useRealtimeRefresh('countdowns', refresh);
  useRealtimeRefresh('schedules', refresh);

  return (
    <Card participantColor="both" tone="secondary" style={{ gap: theme.spacing.md }}>
      <AppText variant="section">Across the distance</AppText>
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText accessibilityLabel={`${profile?.display_name ?? 'Your'} local time ${formatTime(profile?.timezone, new Date(now))}`} variant="pageTitle" style={{ flex: 1, color: participantPalette(myColor).accent }}>{formatTime(profile?.timezone, new Date(now))}</AppText>
          <AppText variant="caption" tone="muted" align="center">{partnerProfile ? timeDifferenceLabel(profile?.timezone, partnerProfile.timezone, new Date(now)) : 'Waiting'}</AppText>
          <AppText accessibilityLabel={`${partnerProfile?.display_name ?? 'Partner'} local time ${partnerProfile ? formatTime(partnerProfile.timezone, new Date(now)) : 'unavailable'}`} variant="pageTitle" align="right" style={{ flex: 1, color: participantPalette(partnerColor).accent }}>{partnerProfile ? formatTime(partnerProfile.timezone, new Date(now)) : '—'}</AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
          <ParticipantIdentityBadge userId={profile?.id} compact />
          <ParticipantIdentityBadge userId={partnerProfile?.id} compact />
        </View>
      </View>

      {members.some((member) => member.sharingEnabled) ? <Pressable accessibilityRole="button" onPress={() => router.push('/features/location' as never)} style={({ pressed }) => ({ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 7, opacity: pressed ? 0.68 : 1 })}>
        <AppIcon name="location" size={18} color={theme.colors.accent} /><View style={{ flex: 1 }}><AppText variant="bodySmall" style={{ fontWeight: '600' }}>Live location</AppText><AppText variant="caption" tone="muted">{members.filter((member) => member.sharingEnabled).length === 2 ? 'Both sharing' : 'One of you is sharing'}</AppText></View><AppIcon name="chevron" size={15} color={theme.colors.textMuted} />
      </Pressable> : null}
      <Pressable accessibilityRole="button" onPress={() => router.push('/features/countdowns' as never)} style={({ pressed }) => ({ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 7, opacity: pressed ? 0.68 : 1 })}>
        <AppIcon name="countdown" size={18} color={theme.colors.accent} />
        <View style={{ flex: 1 }}><AppText variant="bodySmall" style={{ fontWeight: '600' }}>{countdown?.title ?? 'Next visit'}</AppText><AppText variant="caption" tone="muted">Countdown</AppText></View>
        <AppText variant="cardTitle">{countdown ? `${countdownRemaining(countdown.target_at, now).days} days` : 'Add'}</AppText><AppIcon name="chevron" size={15} color={theme.colors.textMuted} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/features/availability' as never)} style={({ pressed }) => ({ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 7, opacity: pressed ? 0.68 : 1 })}>
        <AppIcon name="availability" size={18} color={theme.colors.accent} />
        <View style={{ flex: 1 }}><AppText variant="bodySmall" style={{ fontWeight: '600' }}>Free together</AppText><AppText variant="caption" tone="muted">{overlapLabel(overlap, profile?.timezone)}</AppText></View>
        <AppIcon name="chevron" size={15} color={theme.colors.textMuted} />
      </Pressable>
    </Card>
  );
}
