import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { DetailsToggle } from '@/components/common/DetailsToggle';
import { EmptyState } from '@/components/common/EmptyState';
import { createList, getLists } from '@/services/backend/coreFeatures';
import { getTags } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { CoupleList, Tag } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon } from '@/components/art/AppIcon';
import { useWorkspace } from '@/providers/WorkspaceProvider';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }

export default function ListsScreen() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [lists, setLists] = useState<CoupleList[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newListTitle, setNewListTitle] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { const [next, nextTags] = await Promise.all([getLists(), getTags()]); setLists(next); setTags(nextTags); }
    catch (error) { Alert.alert('Couldn’t load lists', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('lists', refresh); useRealtimeRefresh('tags', refresh);

  async function addList() {
    if (!newListTitle.trim()) return;
    setBusy(true);
    try {
      const created = await createList(newListTitle.trim(), selectedTagIds);
      setNewListTitle(''); setSelectedTagIds([]); setDetailsOpen(false); setComposerOpen(false); await refresh();
      router.push(`/features/lists/${created.id}` as never);
    } catch (error) { Alert.alert('Couldn’t create list', messageFrom(error)); }
    finally { setBusy(false); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Plan" title="Shared lists" subtitle="Shopping, packing and shared lists." />
      <CollapsibleComposer title="Our lists" subtitle={`${lists.length} ${lists.length === 1 ? 'list' : 'lists'} in your shared space`} open={composerOpen} actionLabel="New list" tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => setComposerOpen((value) => !value)}>
        <FormField label="What is this list for?" value={newListTitle} onChangeText={setNewListTitle} placeholder="Things to pack" />
        <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add tags" openLabel="Hide tags" />
        {detailsOpen ? <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} /> : null}
        <AppButton label={busy ? 'Creating…' : 'Create list'} disabled={busy || !newListTitle.trim()} onPress={addList} />
      </CollapsibleComposer>

      <View style={{ gap: theme.spacing.md }}>
        {loading ? <AppText tone="muted">Loading lists…</AppText> : null}
        {!loading && lists.length === 0 ? <EmptyState icon="list" title="Start your first shared list" body="Create a list for groceries, packing, ideas, or anything you want to keep in one place together." actionLabel="Create a list" onAction={() => setComposerOpen(true)} /> : null}
        {lists.map((list) => (
          <Pressable accessibilityRole="button" key={list.id} onPress={() => router.push(`/features/lists/${list.id}` as never)}>
            {({ pressed }) => (
              <Card participantColor="both" style={{ gap: theme.spacing.sm, opacity: pressed ? 0.75 : 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText variant="cardTitle">{list.title}</AppText>
                    <ParticipantAttribution userId={list.creator_id} />
                    <AppText variant="bodySmall" tone="secondary">{list.completed_count ?? 0}/{list.item_count ?? 0} completed</AppText>
                    {(list.tags ?? []).length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>{(list.tags ?? []).slice(0, 4).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View> : null}
                  </View>
                  <AppIcon name="chevron" size={17} color={theme.colors.textMuted} />
                </View>
              </Card>
            )}
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}
