import { DataStatus } from '@/components/common/DataStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { ExpandableFeatureGroup, type ExpandableFeatureGroupItem } from '@/components/navigation/ExpandableFeatureGroup';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { getMemories, getTimeline } from '@/services/backend/mvpFeatures';
import { getPhotoAlbums, getPhotos } from '@/services/backend/photos';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleMemory, CouplePhoto, PhotoAlbum } from '@/types/database';

type TimelineSummary = {
  couple: {
    relationship_start_date: string | null;
    anniversary_date: string | null;
  } | null;
  milestones: CoupleMemory[];
};

function relationshipAge(startDate: string | null | undefined) {
  if (!startDate) return null;
  const start = new Date(`${startDate}T12:00:00`).getTime();
  if (!Number.isFinite(start)) return null;

  const days = Math.max(1, Math.floor((Date.now() - start) / 86_400_000) + 1);
  if (days < 60) return `${days} days`;

  const months = Math.floor(days / 30.4375);
  if (months < 24) return `${months} months`;

  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years}y ${remainder}m` : `${years} years`;
}

function relativeMemoryDate(dateKey: string | undefined) {
  if (!dateKey) return null;
  const target = new Date(`${dateKey}T12:00:00`).getTime();
  if (!Number.isFinite(target)) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  const days = Math.round((today - target) / 86_400_000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(target));
}

function sameMonthAndDay(date: string, now = new Date()) {
  const parts = date.split('-');
  return parts.length === 3
    && Number(parts[1]) === now.getMonth() + 1
    && Number(parts[2]) === now.getDate()
    && Number(parts[0]) < now.getFullYear();
}

function StorySummaryCard({
  icon,
  title,
  summary,
  status,
  href,
}: {
  icon: AppIconName;
  title: string;
  summary: string;
  status?: string;
  href: string;
}) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}${status ? `. ${status}` : ''}`}
      onPress={() => router.push(href as never)}
    >
      {({ pressed }) => (
        <Card participantColor="both" style={{ padding: theme.spacing.lg, opacity: pressed ? 0.78 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.elevatedBackground,
              }}
            >
              <AppIcon name={icon} size={20} color={theme.colors.accent} />
            </View>

            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="section">{title}</AppText>
              <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{summary}</AppText>
            </View>

            {status ? <AppText variant="caption" tone="muted" numberOfLines={1}>{status}</AppText> : null}
            <AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

// G5_US_STORY_CONSOLIDATION: Us owns the relationship-story navigation layer; Memories itself stays focused on memory entries.
export function UsStoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [memories, setMemories] = useState<CoupleMemory[]>([]);
  const [photos, setPhotos] = useState<CouplePhoto[]>([]);
  const [photoAlbums, setPhotoAlbums] = useState<PhotoAlbum[]>([]);
  const [timeline, setTimeline] = useState<TimelineSummary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [memoryResult, photoResult, albumResult, timelineResult] = await Promise.allSettled([
      getMemories(),
      getPhotos(),
      getPhotoAlbums(),
      getTimeline(),
    ]);

    setLoading(false); setLoadError([memoryResult, photoResult, albumResult, timelineResult].some((result) => result.status === 'rejected'));
    if (memoryResult.status === 'fulfilled') setMemories(memoryResult.value);
    if (photoResult.status === 'fulfilled') setPhotos(photoResult.value);
    if (albumResult.status === 'fulfilled') setPhotoAlbums(albumResult.value);
    if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value);
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useRealtimeRefresh('memories', refresh);
  // H2_STANDALONE_PHOTO_GALLERY: the Us summary now reflects the same first-class Photos data as the Photos screen.
  useRealtimeRefresh('photos', refresh);

  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => b.memory_date.localeCompare(a.memory_date)),
    [memories],
  );
  const latest = sortedMemories[0] ?? null;
  const onThisDay = useMemo(
    () => sortedMemories.find((memory) => sameMonthAndDay(memory.memory_date)) ?? null,
    [sortedMemories],
  );
  const photoCount = photos.length;
  const milestoneCount = timeline?.milestones.length ?? memories.filter((memory) => memory.is_milestone).length;
  const age = relationshipAge(timeline?.couple?.relationship_start_date);

  const rediscoverItems = useMemo<ExpandableFeatureGroupItem[]>(() => {
    const items: ExpandableFeatureGroupItem[] = [];

    if (onThisDay) {
      items.push({
        key: 'on-this-day',
        icon: 'timeline',
        title: 'On this day',
        subtitle: `${onThisDay.emoji} ${onThisDay.title} · ${onThisDay.memory_date.slice(0, 4)}`,
        href: `/features/memories?focus=${encodeURIComponent(onThisDay.id)}`,
      });
    }

    items.push({
      key: 'memory-jar',
      icon: 'jar',
      title: 'Memory Jar',
      subtitle: 'Bring back a random saved moment',
      href: '/features/memory-jar',
    });

    items.push({ key: 'capsules', icon: 'heart', title: 'Open together', subtitle: 'Notes and photos saved for a future moment', href: '/features/time-capsules' });
    return items;
  }, [onThisDay]);

  const memorySummary = memories.length
    ? `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} · latest ${relativeMemoryDate(latest?.memory_date) ?? 'saved'}`
    : 'No memories yet · start with one moment';

  const photoSummary = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} · ${photoAlbums.length} ${photoAlbums.length === 1 ? 'album' : 'albums'}`;
  const timelineSummary = `${milestoneCount} ${milestoneCount === 1 ? 'milestone' : 'milestones'}${age ? ` · ${age} together` : ''}`;
  const rediscoverSummary = onThisDay
    ? `On this day: ${onThisDay.title} · Memory Jar`
    : memories.length
      ? 'Memory Jar · On This Day when a date comes around'
      : 'Rediscovery tools will grow with your story';

  return (
    <View style={{ gap: 12 }}>
      <DataStatus loading={loading} error={loadError} retry={() => { void refresh(); }} />
      {!loading && latest ? <Pressable accessibilityRole="button" accessibilityLabel={`Open memory: ${latest.title}`} onPress={() => router.push(`/features/memories?focus=${latest.id}` as never)}>
        <Card style={{ gap: 10 }}>
          {(latest.photo_url || latest.photos?.[0]?.media_url) ? <Image source={{ uri: latest.photo_url || latest.photos?.[0]?.media_url || '' }} accessibilityLabel={latest.title} style={{ width: '100%', height: 240, borderRadius: 16 }} resizeMode="cover" /> : null}
          <AppText variant="caption" tone="secondary">{onThisDay?.id === latest.id ? 'ON THIS DAY' : 'OUR LATEST MOMENT'}</AppText>
          <AppText variant="section">{latest.emoji} {latest.title}</AppText>
          {latest.description ? <AppText tone="secondary" numberOfLines={3}>{latest.description}</AppText> : null}
        </Card>
      </Pressable> : null}
      <StorySummaryCard
        icon="memory"
        title="Memories"
        summary={loading ? 'Loading…' : loadError ? 'Some information unavailable' : memorySummary}
        status={memories.length ? String(memories.length) : undefined}
        href="/features/memories"
      />

      <StorySummaryCard
        icon="photo"
        title="Photos"
        summary={loading ? 'Loading…' : loadError ? 'Some information unavailable' : photoSummary}
        status={photoCount ? String(photoCount) : undefined}
        href="/features/photos"
      />

      <StorySummaryCard
        icon="timeline"
        title="Timeline"
        summary={loading ? 'Loading…' : loadError ? 'Some information unavailable' : timelineSummary}
        status={milestoneCount ? String(milestoneCount) : undefined}
        href="/features/timeline"
      />

      <ExpandableFeatureGroup
        eyebrow="REDISCOVER"
        icon="jar"
        title="Rediscover"
        summary={loading ? 'Loading…' : loadError ? 'Some information unavailable' : rediscoverSummary}
        items={rediscoverItems}
        participantColor="both"
      />
    </View>
  );
}
