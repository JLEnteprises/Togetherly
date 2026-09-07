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
    { icon: 'game' as AppIconName, label: activeGame ? `Continue ${activeGame.title}` : 'Play together', href: activeGame ? `/features/games/${activeGame.id}` : '/features/play-together' },
    { icon: 'date' as AppIconName, label: 'Pick a date', href: '/features/activities' },
    { icon: 'memory' as AppIconName, label: 'Save a memory', href: '/features/memories' },
  ], [activeGame]);
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">DO SOMETHING</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {actions.map((action, index) => <Pressable key={action.label} accessibilityRole="button" onPress={() => router.push(action.href as never)} style={({ pressed }) => ({ minHeight: 48, flexGrow: index === 0 && activeGame ? 2 : 1, minWidth: index === 0 && activeGame ? '100%' : '30%', borderRadius: theme.radii.md, backgroundColor: pressed ? theme.colors.cardElevated : theme.colors.elevatedBackground, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: theme.spacing.md, paddingVertical: 10, opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
          <AppIcon name={action.icon} size={18} color={theme.colors.accent} /><AppText variant="bodySmall" style={{ fontWeight: '700' }} numberOfLines={1}>{action.label}</AppText>
        </Pressable>)}
      </View>
    </View>
  );
}
