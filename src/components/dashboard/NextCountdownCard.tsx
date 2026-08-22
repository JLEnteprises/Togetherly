import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { AppText } from '@/components/common/AppText';
import { getCountdowns } from '@/services/backend/coreFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { CoupleCountdown } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes } from '@/theme/tokens';
import { useWorkspace } from '@/providers/WorkspaceProvider';

function daysUntil(value: string) {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export function NextCountdownCard() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [countdown, setCountdown] = useState<CoupleCountdown | null>(null);
  const refresh = useCallback(async () => {
    const all = await getCountdowns();
    setCountdown(all.find((item) => new Date(item.target_at).getTime() >= Date.now()) ?? null);
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('countdowns', refresh);

  const creatorColor = countdown ? colorForUser(countdown.creator_id) : null;
  const palette = creatorColor && creatorColor !== 'both' ? participantPalettes[creatorColor] : null;

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/features/countdowns' as never)}>
      {({ pressed }) => (
        <Card participantColor={creatorColor ?? 'both'} style={{ gap: theme.spacing.md, opacity: pressed ? 0.78 : 1 }}>
          <AppText variant="caption" tone="secondary">NEXT COUNTDOWN</AppText>
          {countdown ? (
            <View>
              <AppText variant="numeric" style={{ color: palette?.accent ?? theme.colors.accent }}>{daysUntil(countdown.target_at)}</AppText>
              <AppText variant="cardTitle">days · {countdown.title}</AppText>
              <ParticipantAttribution userId={countdown.creator_id} />
              <AppText variant="bodySmall" tone="secondary">Tap to see all countdowns ›</AppText>
            </View>
          ) : (
            <View style={{ gap: 5 }}>
              <AppText variant="section">Give the distance an end point.</AppText>
              <AppText variant="bodySmall" tone="secondary">Add your next visit, flight or anniversary countdown ›</AppText>
            </View>
          )}
        </Card>
      )}
    </Pressable>
  );
}
