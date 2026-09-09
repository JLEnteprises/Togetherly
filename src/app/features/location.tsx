import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { ToggleRow } from '@/components/common/ToggleRow';
import { PartnerMap } from '@/components/location/PartnerMap';
import { useLocationSharing } from '@/providers/LocationProvider';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

function ageLabel(value: string | null, now: number) {
  if (!value) return 'No location yet';
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (seconds < 45) return 'Live';
  if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `Updated ${Math.floor(seconds / 3600)}h ago`;
  return `Updated ${Math.floor(seconds / 86400)}d ago`;
}

function distanceMeters(a: { latitude: number | null; longitude: number | null }, b: { latitude: number | null; longitude: number | null }) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
  const radius = 6371000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(1, Math.round(meters / 10) * 10).toLocaleString()} m apart`;
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)} km apart`;
  return `${Math.round(km).toLocaleString()} km apart`;
}

export default function LocationScreen() {
  const theme = useAppTheme();
  const { profile } = useWorkspace();
  const { members, sharing, loading, setSharing } = useLocationSharing();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const mine = members.find((member) => member.userId === profile?.id);
  const partner = members.find((member) => member.userId !== profile?.id);
  const distance = mine && partner ? distanceMeters(mine, partner) : null;
  const visibleCount = useMemo(() => members.filter((member) => member.sharingEnabled && member.latitude != null && member.longitude != null).length, [members]);

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Live location" />
      <View style={{ gap: theme.spacing.lg }}>
        <Card participantColor="both" style={{ gap: theme.spacing.md }}>
          <ToggleRow
            label="Share my location"
            subtitle="Shares with your partner; background updates depend on device permission."
            value={sharing}
            disabled={loading}
            onChange={(value) => setSharing(value).catch((error) => Alert.alert('Couldn’t change location sharing', error instanceof Error ? error.message : 'Try again.'))}
          />
          {distance != null ? <AppText variant="cardTitle" align="center">{formatDistance(distance)}</AppText> : null}
        </Card>

        <PartnerMap members={members} />

        <View style={{ gap: theme.spacing.sm }}>
          {members.map((member) => (
            <Card key={member.userId} participantColor={member.participantColor} tone="secondary" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: participantPalette(member.participantColor).accent }} />
              <View style={{ flex: 1 }}>
                <AppText variant="cardTitle">{member.displayName}</AppText>
                <AppText variant="caption" tone="muted">{member.sharingEnabled ? ageLabel(member.capturedAt, now) : 'Location off'}</AppText>
              </View>
            </Card>
          ))}
          {!members.length && !visibleCount ? <AppText variant="bodySmall" tone="muted">Location will appear here after your couple space is linked.</AppText> : null}
        </View>
      </View>
    </AppScreen>
  );
}
