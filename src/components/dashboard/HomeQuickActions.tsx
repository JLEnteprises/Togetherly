import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/common/AppText';
import { getGames } from '@/services/backend/games';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useAppTheme } from '@/theme/useAppTheme';
import type { GameSession } from '@/types/database';

export function HomeQuickActions() {
  const theme = useAppTheme();
  const [activeGame, setActiveGame] = useState<GameSession | null>(null);
  const refresh = useCallback(async () => {
    try { setActiveGame((await getGames()).find((game) => game.status === 'active') ?? null); }
    catch { setActiveGame(null); }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('games', refresh);

  const actions = useMemo(() => [
    ['✦', activeGame ? `Continue ${activeGame.title}` : 'Play', activeGame ? `/features/games/${activeGame.id}` : '/features/play-together'],
    ['♡', 'Date idea', '/features/activities'],
    ['✓', 'Tasks', '/features/tasks'],
    ['◇', 'Memory', '/features/memories'],
  ] as const, [activeGame]);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">QUICK ACTIONS</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {actions.map(([icon, label, href]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            onPress={() => router.push(href as never)}
            style={({ pressed }) => ({
              minHeight: 44,
              flexGrow: 1,
              minWidth: '46%',
              borderRadius: theme.radii.md,
              backgroundColor: pressed ? theme.colors.cardElevated : theme.colors.elevatedBackground,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 9,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <AppText tone="accent">{icon}</AppText><AppText variant="bodySmall" style={{ fontWeight: '700' }} numberOfLines={1}>{label}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
