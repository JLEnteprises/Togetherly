import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getMemories } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleMemory } from '@/types/database';

export function RecentMemoryCard() {
  const theme = useAppTheme(); const { colorForUser } = useWorkspace(); const [memory, setMemory] = useState<CoupleMemory | null>(null);
  const refresh = useCallback(async () => { const all = await getMemories(); setMemory(all[0] ?? null); }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('memories', refresh);
  if (!memory) return null;
  return <Pressable accessibilityRole="button" onPress={() => router.push((memory ? `/features/memories?focus=${memory.id}` : '/features/memories') as never)}>{({ pressed }) => <Card participantColor={memory ? colorForUser(memory.creator_id) : 'both'} style={{ gap: theme.spacing.sm, opacity: pressed ? 0.76 : 1 }}><AppText variant="caption" tone="secondary">A LITTLE MEMORY</AppText>{memory?.photo_url ? <Image accessibilityLabel={memory.title} source={{ uri: memory.photo_url }} style={{ width: '100%', height: 180, borderRadius: 16 }} contentFit="cover" cachePolicy="memory-disk" transition={0} /> : null}{memory ? <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}><AppText variant="pageTitle">{memory.emoji}</AppText><View style={{ flex: 1, gap: 3 }}><AppText variant="cardTitle">{memory.title}</AppText><ParticipantAttribution userId={memory.creator_id} /><AppText variant="caption" tone="muted">{memory.memory_date}</AppText></View></View> : <><AppText variant="section">Save your first memory.</AppText><AppText variant="bodySmall" tone="secondary">Your story will start appearing here.</AppText></>}</Card>}</Pressable>;
}
