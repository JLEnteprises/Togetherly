import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { AppText } from '@/components/common/AppText';
import { getCountdowns } from '@/services/backend/coreFeatures';
import { getAvailabilityOverlaps } from '@/services/backend/availability';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { AvailabilityOverlap, CoupleCountdown, LiveLocationMember } from '@/types/database';
import { useLocationSharing } from '@/providers/LocationProvider';
import { AppIcon } from '@/components/art/AppIcon';
import { countdownRemaining } from '@/utils/countdown';

function formatTime(timezone: string | undefined, date = new Date()) {
  try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone || 'UTC' }).format(date); }
  catch { return '—'; }
}
function formatDayTime(timezone: string | undefined, date: Date) {
  try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: timezone || 'UTC' }).format(date); }
  catch { return '—'; }
}
function timezonePlace(timezone: string | undefined) {
  const value = timezone?.split('/').pop()?.replaceAll('_', ' ').trim();
  return value ? value.toUpperCase() : 'LOCAL TIME';
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
function distanceKm(a: LiveLocationMember | undefined, b: LiveLocationMember | undefined) {
  if (a?.latitude == null || a.longitude == null || b?.latitude == null || b.longitude == null) return null;
  const toRad = (value: number) => value * Math.PI / 180;
  const earthKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function ActionRow({ icon, title, detail, onPress }: { icon: 'availability' | 'location'; title: string; detail: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 8, opacity: pressed ? 0.68 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={18} color={theme.colors.accent} /></View>
      <View style={{ flex: 1, gap: 2 }}><AppText variant="bodySmall" style={{ fontWeight: '700' }}>{title}</AppText><AppText variant="caption" tone="muted" numberOfLines={2}>{detail}</AppText></View>
      <AppIcon name="chevron" size={15} color={theme.colors.textMuted} />
    </Pressable>
  );
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

  const currentDate = new Date(now);
  const remaining = countdown ? countdownRemaining(countdown.target_at, now) : null;
  const myMember = members.find((member) => member.userId === profile?.id);
  const partnerMember = members.find((member) => member.userId === partnerProfile?.id);
  const separationKm = useMemo(() => distanceKm(myMember, partnerMember), [myMember?.latitude, myMember?.longitude, partnerMember?.latitude, partnerMember?.longitude]);
  const bothSharing = Boolean(myMember?.sharingEnabled && partnerMember?.sharingEnabled);
  const anySharing = Boolean(myMember?.sharingEnabled || partnerMember?.sharingEnabled);
  const overlapStart = overlap ? new Date(overlap.startAt) : null;
  const overlapDetail = overlap && overlapStart
    ? `${formatDayTime(profile?.timezone, overlapStart)} / ${formatDayTime(partnerProfile?.timezone, overlapStart)} · ${durationLabel(overlap.durationMinutes)}`
    : 'Add your free-time windows to find the next overlap.';

  return (
    <Card participantColor="both" tone="secondary" style={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}>
      <View style={{ gap: 3 }}>
        <AppText variant="section">Across the distance</AppText>
        <AppText variant="bodySmall" tone="muted">Your two days, in one shared view.</AppText>
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
          <View style={{ flex: 1, gap: 5 }}>
            <AppText variant="caption" tone="muted">{timezonePlace(profile?.timezone)}</AppText>
            <AppText accessibilityLabel={`${profile?.display_name ?? 'Your'} local time ${formatTime(profile?.timezone, currentDate)}`} variant="pageTitle" style={{ color: participantPalette(myColor).accent }}>{formatTime(profile?.timezone, currentDate)}</AppText>
            <ParticipantIdentityBadge userId={profile?.id} compact />
          </View>
          <View style={{ alignItems: 'center', gap: 5, paddingBottom: 7 }}>
            <View style={{ height: 1, width: 36, backgroundColor: theme.colors.border }} />
            <AppText variant="caption" tone="secondary">{partnerProfile ? timeDifferenceLabel(profile?.timezone, partnerProfile.timezone, currentDate) : 'Waiting'}</AppText>
            <View style={{ height: 1, width: 36, backgroundColor: theme.colors.border }} />
          </View>
          <View style={{ flex: 1, gap: 5, alignItems: 'flex-end' }}>
            <AppText variant="caption" tone="muted">{timezonePlace(partnerProfile?.timezone)}</AppText>
            <AppText accessibilityLabel={`${partnerProfile?.display_name ?? 'Partner'} local time ${partnerProfile ? formatTime(partnerProfile.timezone, currentDate) : 'unavailable'}`} variant="pageTitle" align="right" style={{ color: participantPalette(partnerColor).accent }}>{partnerProfile ? formatTime(partnerProfile.timezone, currentDate) : '—'}</AppText>
            <ParticipantIdentityBadge userId={partnerProfile?.id} compact />
          </View>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/features/countdowns' as never)}>
        {({ pressed }) => (
          <View style={{ borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.accentSoft, padding: theme.spacing.lg, gap: 4, opacity: pressed ? 0.78 : 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm }}>
              <AppText variant="caption" tone="secondary">{countdown ? 'UNTIL YOU’RE TOGETHER' : 'NEXT TIME TOGETHER'}</AppText>
              <AppIcon name="chevron" size={15} color={theme.colors.textMuted} />
            </View>
            <AppText variant="pageTitle">{remaining ? `${remaining.days} ${remaining.days === 1 ? 'day' : 'days'}` : 'Add a countdown'}</AppText>
            <AppText variant="bodySmall" tone="secondary">{countdown?.title ?? 'Give your next visit something to count down to.'}</AppText>
          </View>
        )}
      </Pressable>

      <View style={{ gap: 0 }}>
        <ActionRow icon="availability" title="Next free together" detail={overlapDetail} onPress={() => router.push('/features/availability' as never)} />
        {anySharing ? (
          <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}>
            <ActionRow
              icon="location"
              title={separationKm != null && bothSharing ? `${separationKm.toLocaleString()} km apart` : 'Live location'}
              detail={bothSharing ? 'Both of you are sharing your current location.' : 'One of you is sharing a live location.'}
              onPress={() => router.push('/features/location' as never)}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
