import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getTimeline } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleMemory } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function TimelineScreen() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [milestones, setMilestones] = useState<CoupleMemory[]>([]);
  const [relationshipStart, setRelationshipStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { const result = await getTimeline(); setMilestones(result.milestones); setRelationshipStart(result.couple?.relationship_start_date ?? null); }
    catch (error) { Alert.alert('Couldn’t load timeline', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('memories', refresh);

  const timeline = relationshipStart && !milestones.some((m) => m.memory_date === relationshipStart && m.title.toLowerCase().includes('dating'))
    ? [{ id: 'relationship-start', creator_id: '', title: 'Relationship began', description: 'The date saved in your couple profile.', memory_date: relationshipStart, emoji: '♥', location: '', is_milestone: true, photo_url: null, couple_id: '', created_at: relationshipStart, updated_at: relationshipStart } as CoupleMemory, ...milestones].sort((a,b) => a.memory_date.localeCompare(b.memory_date))
    : milestones;

  return (
    <AppScreen>
      <BackHeader eyebrow="Us" title="Relationship timeline" subtitle="Your relationship milestones." />
      {loading ? <AppText tone="muted">Loading timeline…</AppText> : null}
      {!loading && timeline.length === 0 ? <EmptyState icon="timeline" title="No milestones yet" body="Mark a memory as a milestone to add it here." actionLabel="Add a memory" onAction={() => router.push('/features/memories' as never)} /> : null}
      {timeline.length ? (
        <Card style={{ gap: 0 }}>
          {timeline.map((memory, index) => {
            const participantColor = memory.creator_id ? colorForUser(memory.creator_id) : 'both';
            const palette = participantColor === 'both' ? null : participantPalette(participantColor);
            return (
              <View key={memory.id} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette?.accentSoft ?? theme.colors.secondarySoft, borderWidth: 1, borderColor: palette?.border ?? theme.colors.border, alignItems: 'center', justifyContent: 'center' }}><AppText style={{ color: palette?.accent ?? theme.colors.secondaryAccent }}>{memory.emoji}</AppText></View>
                  {index < timeline.length - 1 ? <View style={{ width: 2, height: 70, backgroundColor: theme.colors.vineSoft }} /> : null}
                </View>
                <View style={{ flex: 1, paddingTop: 4, gap: 4 }}>
                  <AppText variant="caption" tone="muted">{memory.memory_date}</AppText>
                  <AppText variant="cardTitle">{memory.title}</AppText>
                  {memory.creator_id ? <ParticipantAttribution userId={memory.creator_id} /> : null}
                  {memory.description ? <AppText variant="bodySmall" tone="secondary">{memory.description}</AppText> : null}
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}
    </AppScreen>
  );
}
