import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/common/AppText';
import { AppIcon } from '@/components/art/AppIcon';
import { Card } from '@/components/common/Card';
import { getGames } from '@/services/backend/games';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useAppTheme } from '@/theme/useAppTheme';
import type { GameSession } from '@/types/database';

// G2_HOME_DECLUTTER: this legacy Home-layout slot is contextual now; it renders only when a shared game is already active.
export function HomeQuickActions() {
  const theme = useAppTheme();
  const [activeGame, setActiveGame] = useState<GameSession | null>(null);

  const refresh = useCallback(async () => {
    try {
      setActiveGame((await getGames()).find((game) => game.status === 'active') ?? null);
    } catch {
      setActiveGame(null);
    }
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('games', refresh);

  if (!activeGame) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ gap: 2 }}>
        <AppText variant="section">In progress</AppText>
        <AppText variant="bodySmall" tone="muted">Something you’re already doing together.</AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continue ${activeGame.title}. Your shared game is waiting.`}
        onPress={() => router.push(`/features/games/${activeGame.id}` as never)}
      >
        {({ pressed }) => (
          <Card participantColor="both" style={{ padding: theme.spacing.md, opacity: pressed ? 0.78 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.elevatedBackground,
                }}
              >
                <AppIcon name="game" size={19} color={theme.colors.textSecondary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="cardTitle" numberOfLines={1}>Continue {activeGame.title}</AppText>
                <AppText variant="caption" tone="muted">Your shared game is waiting.</AppText>
              </View>
              <AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
            </View>
          </Card>
        )}
      </Pressable>
    </View>
  );
}
