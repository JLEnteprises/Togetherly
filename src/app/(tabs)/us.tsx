import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { MemoryConstellationArt } from '@/components/art/TogetherlyArt';
import { FadeSlideIn, GentleFloat } from '@/components/motion/Motion';
import { RecentMemoryCard } from '@/components/dashboard/RecentMemoryCard';
import { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { getMemories, getMemoryAlbums, getTimeline } from '@/services/backend/mvpFeatures';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleMemory, MemoryAlbum } from '@/types/database';

type TimelineSummary = { couple: { relationship_start_date: string | null; anniversary_date: string | null } | null; milestones: CoupleMemory[] };

function relationshipAge(startDate: string | null | undefined) {
  if (!startDate) return null;
  const start = new Date(`${startDate}T12:00:00`).getTime();
  if (!Number.isFinite(start)) return null;
  const days = Math.max(1, Math.floor((Date.now() - start) / 86_400_000) + 1);
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30.4375);
  if (months < 24) return `${months} months`;
  const years = Math.floor(months / 12); const remainder = months % 12;
  return remainder ? `${years}y ${remainder}m` : `${years} years`;
}
function sameMonthAndDay(date: string, now = new Date()) { const parts = date.split('-'); return parts.length === 3 && Number(parts[1]) === now.getMonth() + 1 && Number(parts[2]) === now.getDate() && Number(parts[0]) < now.getFullYear(); }
function Stat({ value, label }: { value: string | number; label: string }) { return <View style={{ flex: 1, minWidth: 72, gap: 2 }}><AppText variant="section">{value}</AppText><AppText variant="caption" tone="muted">{label}</AppText></View>; }

function StoryLink({ icon, title, subtitle, href, topBorder }: { icon: AppIconName; title: string; subtitle: string; href: string; topBorder?: boolean }) {
  const theme = useAppTheme();
  return <Pressable accessibilityRole="button" onPress={() => router.push(href as never)} style={({ pressed }) => ({ minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 10, borderTopWidth: topBorder ? 1 : 0, borderTopColor: theme.colors.border, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={20} color={theme.colors.accent} /></View>
    <View style={{ flex: 1, gap: 2 }}><AppText variant="cardTitle">{title}</AppText><AppText variant="bodySmall" tone="secondary">{subtitle}</AppText></View><AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
  </Pressable>;
}

export default function UsScreen() {
  const theme = useAppTheme();
  const [memories, setMemories] = useState<CoupleMemory[]>([]);
  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [timeline, setTimeline] = useState<TimelineSummary | null>(null);

  const refresh = useCallback(async () => {
    const [memoryResult, albumResult, timelineResult] = await Promise.allSettled([getMemories(), getMemoryAlbums(), getTimeline()]);
    if (memoryResult.status === 'fulfilled') setMemories(memoryResult.value);
    if (albumResult.status === 'fulfilled') setAlbums(albumResult.value);
    if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value);
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('memories', refresh);

  const photoCount = useMemo(() => memories.reduce((total, memory) => total + ((memory.photos?.length ?? 0) || (memory.photo_url ? 1 : 0)), 0), [memories]);
  const milestoneCount = timeline?.milestones.length ?? memories.filter((memory) => memory.is_milestone).length;
  const age = relationshipAge(timeline?.couple?.relationship_start_date);
  const onThisDay = useMemo(() => memories.find((memory) => sameMonthAndDay(memory.memory_date)) ?? null, [memories]);
  const storyTitle = onThisDay ? 'Today has a memory.' : memories.length ? 'Your story is growing.' : 'Start with one moment.';
  const storyBody = onThisDay ? `You saved “${onThisDay.title}” on this date. Some days come back around.` : memories.length ? 'Not just milestones — the ordinary days are becoming something you can revisit together.' : 'The first photo, funny moment or ordinary day is enough to begin.';

  return (
    <AppScreen>
      <PageHeader eyebrow="Our story" title="Us" subtitle="The part of Togetherly that becomes more yours over time." />
      <View style={{ gap: theme.spacing.xl }}>
        {/* E3_PAIRED_COUPLE_IDENTITY */}
        <CoupleIdentitySignature detail="Your shared story belongs to both of you." />
        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.lg, padding: theme.spacing.xl, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 6 }}><AppText variant="caption" tone="accent">OUR STORY</AppText><AppText variant="hero">{storyTitle}</AppText></View>
            <GentleFloat distance={2}><MemoryConstellationArt width={126} height={70} /></GentleFloat>
          </View>
          <AppText tone="secondary">{storyBody}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg }}>{age ? <Stat value={age} label="TOGETHER" /> : null}<Stat value={memories.length} label="MEMORIES" /><Stat value={photoCount} label="PHOTOS" /><Stat value={milestoneCount} label="MILESTONES" /></View>
          <AppButton icon="memory" label="Add a memory" onPress={() => router.push('/features/memories' as never)} />
        </Card>

        {onThisDay ? <FadeSlideIn><Pressable accessibilityRole="button" onPress={() => router.push('/features/timeline' as never)}>{({ pressed }) => <Card participantColor="both" tone="secondary" style={{ gap: theme.spacing.sm, opacity: pressed ? 0.74 : 1 }}><AppText variant="caption" tone="accent">ON THIS DAY · {onThisDay.memory_date.slice(0, 4)}</AppText><AppText variant="section">{onThisDay.emoji} {onThisDay.title}</AppText>{onThisDay.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={3}>{onThisDay.description}</AppText> : null}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><AppText variant="caption" tone="muted">Open your timeline</AppText><AppIcon name="chevron" size={14} color={theme.colors.textMuted} /></View></Card>}</Pressable></FadeSlideIn> : null}

        <RecentMemoryCard />

        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ gap: 4 }}><AppText variant="section">Explore your story</AppText><AppText variant="bodySmall" tone="secondary">Photos, milestones and little rediscoveries.</AppText></View>
          <View style={{ paddingHorizontal: theme.spacing.sm }}>
            <StoryLink icon="timeline" title="Timeline" subtitle={`${milestoneCount} milestones in order`} href="/features/timeline" />
            <StoryLink topBorder icon="jar" title="Memory jar" subtitle="Bring back a random moment" href="/features/memory-jar" />
            <StoryLink topBorder icon="photo" title="Photos & albums" subtitle={`${photoCount} photos · ${albums.length} albums`} href="/features/photos" />
          </View>
        </View>
      </View>
    </AppScreen>
  );
}
