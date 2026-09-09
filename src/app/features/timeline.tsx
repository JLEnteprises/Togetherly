import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { TagChip } from '@/components/common/TagChip';
import { MemoryDetailModal } from '@/components/memories/MemoryDetailModal';
import { getTimeline } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { formatMemoryDate, memoryCoverUrl, memoryPhotoCount } from '@/utils/memories';
import type { CoupleMemory } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

function syntheticRelationshipStart(date: string): CoupleMemory {
  return {
    id: 'relationship-start',
    couple_id: '',
    creator_id: '',
    title: 'Relationship began',
    description: 'The date saved in your couple profile.',
    memory_date: date,
    location: '',
    is_milestone: true,
    emoji: '♥',
    photo_url: null,
    photos: [],
    tags: [],
    created_at: date,
    updated_at: date,
  };
}

export default function TimelineScreen() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [milestones, setMilestones] = useState<CoupleMemory[]>([]);
  const [relationshipStart, setRelationshipStart] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<CoupleMemory | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await getTimeline();
      setMilestones(result.milestones);
      setRelationshipStart(result.couple?.relationship_start_date ?? null);
    } catch (error) {
      Alert.alert('Couldn’t load timeline', messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('memories', refresh);

  const timeline = useMemo(() => {
    const items = [...milestones];
    const hasRelationshipStart = relationshipStart && items.some((memory) =>
      memory.memory_date === relationshipStart && memory.title.toLowerCase().includes('relationship'),
    );
    if (relationshipStart && !hasRelationshipStart) items.push(syntheticRelationshipStart(relationshipStart));
    return items.sort((a, b) => a.memory_date.localeCompare(b.memory_date));
  }, [milestones, relationshipStart]);

  const chapters = useMemo(() => {
    const groups = new Map<string, CoupleMemory[]>();
    for (const memory of timeline) {
      const year = memory.memory_date.slice(0, 4);
      const group = groups.get(year) ?? [];
      group.push(memory);
      groups.set(year, group);
    }
    return [...groups.entries()];
  }, [timeline]);

  const photoMoments = milestones.filter((memory) => memoryPhotoCount(memory) > 0).length;

  return (
    <AppScreen>
      <BackHeader eyebrow="Us" title="Relationship timeline" subtitle="The moments that became your story." />

      {loading ? <AppText tone="muted">Loading timeline…</AppText> : null}
      {!loading && timeline.length === 0 ? (
        <EmptyState
          icon="timeline"
          title="No milestones yet"
          body="Mark a memory as a milestone and it becomes part of your relationship story."
          actionLabel="Add a memory"
          onAction={() => router.push('/features/memories' as never)}
        />
      ) : null}

      {timeline.length ? (
        <View style={{ gap: theme.spacing.xxl }}>
          <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.sm, padding: theme.spacing.xl }}>
            <AppText variant="caption" tone="secondary">OUR STORY</AppText>
            <AppText variant="pageTitle">{timeline.length} {timeline.length === 1 ? 'chapter' : 'chapters'} worth keeping.</AppText>
            <AppText tone="secondary">
              {photoMoments
                ? `${photoMoments} milestone ${photoMoments === 1 ? 'moment has' : 'moments have'} photos attached. Tap a saved memory to open the full story.`
                : 'Add photos to milestone memories and they’ll become the visual anchors of your timeline.'}
            </AppText>
          </Card>

          {chapters.map(([year, memories]) => (
            <View key={year} style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <AppText variant="section">{year}</AppText>
                <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
                <AppText variant="caption" tone="muted">{memories.length} {memories.length === 1 ? 'moment' : 'moments'}</AppText>
              </View>

              <View>
                {memories.map((memory, index) => {
                  const synthetic = memory.id === 'relationship-start';
                  const participantColor = memory.creator_id ? colorForUser(memory.creator_id) : 'both';
                  const palette = participantColor === 'both' ? null : participantPalette(participantColor);
                  const cover = memoryCoverUrl(memory);
                  const photoCount = memoryPhotoCount(memory);

                  return (
                    <View key={memory.id} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                      <View style={{ width: 34, alignItems: 'center' }}>
                        <View style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          marginTop: 18,
                          backgroundColor: palette?.accent ?? theme.colors.secondaryAccent,
                          borderWidth: 3,
                          borderColor: theme.colors.background,
                        }} />
                        {index < memories.length - 1 ? <View style={{ flex: 1, width: 2, minHeight: 54, backgroundColor: theme.colors.vineSoft }} /> : null}
                      </View>

                      <Pressable
                        accessibilityRole={synthetic ? undefined : 'button'}
                        accessibilityLabel={synthetic ? undefined : `Open memory ${memory.title}`}
                        disabled={synthetic}
                        onPress={() => !synthetic && setDetailTarget(memory)}
                        style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1, marginBottom: theme.spacing.lg })}
                      >
                        <Card participantColor={participantColor} style={{ gap: theme.spacing.md, overflow: 'hidden', padding: 0 }}>
                          {cover ? (
                            <View>
                              <Image
                                source={{ uri: cover }}
                                resizeMode="cover"
                                style={{ width: '100%', aspectRatio: 1.65, backgroundColor: theme.colors.elevatedBackground }}
                              />
                              {photoCount > 1 ? (
                                <View style={{
                                  position: 'absolute',
                                  right: 10,
                                  bottom: 10,
                                  paddingHorizontal: 9,
                                  paddingVertical: 5,
                                  borderRadius: 999,
                                  backgroundColor: 'rgba(0,0,0,0.64)',
                                }}>
                                  <AppText variant="caption" style={{ color: '#ffffff' }}>{photoCount} PHOTOS</AppText>
                                </View>
                              ) : null}
                            </View>
                          ) : null}

                          <View style={{ gap: theme.spacing.sm, padding: theme.spacing.lg }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'flex-start' }}>
                              <View style={{ flex: 1, gap: 4 }}>
                                <AppText variant="caption" tone="secondary">
                                  {formatMemoryDate(memory.memory_date, { month: 'short', day: 'numeric' }).toUpperCase()}
                                </AppText>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                  <AppText variant="section">{memory.emoji}</AppText>
                                  <AppText variant="cardTitle" style={{ flex: 1 }}>{memory.title}</AppText>
                                </View>
                              </View>
                              <TagChip subtle label="MILESTONE" />
                            </View>

                            {memory.creator_id ? <ParticipantAttribution userId={memory.creator_id} /> : null}
                            {memory.location ? <AppText variant="bodySmall" tone="muted">{memory.location}</AppText> : null}
                            {memory.description ? <AppText tone="secondary" numberOfLines={cover ? 3 : 5}>{memory.description}</AppText> : null}
                            {!synthetic ? <AppText variant="caption" tone="accent">TAP TO OPEN MEMORY</AppText> : null}
                          </View>
                        </Card>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <MemoryDetailModal
        memory={detailTarget}
        visible={!!detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </AppScreen>
  );
}
