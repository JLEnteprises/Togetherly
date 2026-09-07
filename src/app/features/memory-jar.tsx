import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Image, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getRandomMemory } from '@/services/backend/mvpFeatures';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleMemory } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function MemoryJarScreen() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [memory, setMemory] = useState<CoupleMemory | null>(null);
  const [loading, setLoading] = useState(true);

  const pull = useCallback(async () => {
    setLoading(true);
    try { setMemory(await getRandomMemory()); }
    catch (error) { Alert.alert('Couldn’t pull a memory', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { pull().catch(() => undefined); }, [pull]);

  return (
    <AppScreen>
      <BackHeader eyebrow="Us" title="Memory jar" subtitle="Pull a saved moment at random." />
      {loading ? <AppText tone="muted">Reaching into the jar…</AppText> : null}
      {!loading && !memory ? <EmptyState icon="jar" title="The jar is empty" body="Save a memory first, then come back and pull one." actionLabel="Add a memory" onAction={() => router.push('/features/memories' as never)} /> : null}
      {memory ? (
        <Card participantColor={colorForUser(memory.creator_id)} style={{ gap: theme.spacing.lg, padding: theme.spacing.xl, overflow: 'hidden' }}>
          {memory.photo_url ? <Image source={{ uri: memory.photo_url }} style={{ width: '100%', height: 220, borderRadius: theme.radii.md }} resizeMode="cover" /> : null}
          <AppText variant="numeric" tone="accent" align="center">{memory.emoji}</AppText>
          <View style={{ gap: 6 }}>
            <AppText variant="pageTitle" align="center">{memory.title}</AppText>
            <AppText variant="caption" tone="secondary" align="center">{memory.memory_date}{memory.location ? ` · ${memory.location}` : ''}</AppText>
          </View>
          {memory.description ? <AppText tone="secondary" align="center">{memory.description}</AppText> : null}
          <View style={{ alignItems: 'center' }}><ParticipantAttribution userId={memory.creator_id} /></View>
          <AppButton icon="spark" label="Pull another memory" onPress={pull} />
        </Card>
      ) : null}
    </AppScreen>
  );
}
