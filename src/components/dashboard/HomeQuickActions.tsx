import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/common/AppText';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { getGames } from '@/services/backend/games';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useAppTheme } from '@/theme/useAppTheme';
import type { GameSession } from '@/types/database';

export function HomeQuickActions() {
  const theme = useAppTheme();
  const [activeGame, setActiveGame] = useState<GameSession | null>(null);
  const refresh = useCallback(async () => { try { setActiveGame((await getGames()).find((game) => game.status === 'active') ?? null); } catch { setActiveGame(null); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('games', refresh);

  const actions = useMemo(() => [
    { icon: 'game' as AppIconName, label: activeGame ? `Continue ${activeGame.title}` : 'Play together', detail: activeGame ? 'Your game is waiting' : 'Start something together', href: activeGame ? `/features/games/${activeGame.id}` : '/features/play-together' },
    { icon: 'date' as AppIconName, label: 'Pick a date', detail: 'Find something to do', href: '/features/activities' },
    { icon: 'memory' as AppIconName, label: 'Save a memory', detail: 'Keep this moment', href: '/features/memories' },
  ], [activeGame]);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ gap: 2 }}>
        <AppText variant="section">Do something together</AppText>
        <AppText variant="bodySmall" tone="muted">Play, plan or keep a moment.</AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {actions.map((action, index) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={`${action.label}. ${action.detail}`}
            onPress={() => router.push(action.href as never)}
            style={({ pressed }) => ({
              minHeight: 74,
              flexGrow: index === 0 && activeGame ? 2 : 1,
              minWidth: index === 0 && activeGame ? '100%' : '30%',
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.cardElevated : theme.colors.elevatedBackground,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 12,
              gap: 8,
              opacity: pressed ? 0.76 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <AppIcon name={action.icon} size={18} color={theme.colors.textSecondary} />
            <View style={{ gap: 1 }}>
              <AppText variant="bodySmall" style={{ fontWeight: '700' }} numberOfLines={1}>{action.label}</AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>{action.detail}</AppText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
