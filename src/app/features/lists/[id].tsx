import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { createListItem, deleteList, deleteListItem, getList, updateList, updateListItem } from '@/services/backend/coreFeatures';
import { getTags } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { CoupleList, CoupleListItem, Priority, Tag } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes } from '@/theme/tokens';
import { useWorkspace } from '@/providers/WorkspaceProvider';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }

export default function ListDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorForUser } = useWorkspace();
  const [list, setList] = useState<CoupleList | null>(null);
  const [items, setItems] = useState<CoupleListItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [itemLink, setItemLink] = useState('');
  const [itemPriority, setItemPriority] = useState<Priority>('normal');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [deleteListOpen, setDeleteListOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<CoupleListItem | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, nextTags] = await Promise.all([getList(id), getTags()]);
      setList(detail.list); setItems(detail.items); setTags(nextTags); setRenameTitle(detail.list.title); setSelectedTags((detail.list.tags ?? []).map((tag) => tag.id));
    } catch (error) { Alert.alert('Couldn’t open list', messageFrom(error)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('lists', refresh); useRealtimeRefresh('tags', refresh);

  const openItems = useMemo(() => items.filter((item) => !item.completed), [items]);
  const completedItems = useMemo(() => items.filter((item) => item.completed), [items]);

  function resetItemEditor(close = true) {
    setEditingItemId(null); setItemTitle(''); setItemNotes(''); setItemLink(''); setItemPriority('normal'); setMoreOpen(false); if (close) setComposerOpen(false);
  }
  function editItem(item: CoupleListItem) {
    setEditingItemId(item.id); setItemTitle(item.title); setItemNotes(item.notes); setItemLink(item.link ?? ''); setItemPriority(item.priority); setMoreOpen(true); setComposerOpen(true);
  }
  async function saveItem() {
    if (!list || !itemTitle.trim()) return;
    setBusy(true);
    try {
      const input = { title: itemTitle.trim(), notes: itemNotes.trim(), link: itemLink.trim() || null, priority: itemPriority };
      if (editingItemId) await updateListItem(editingItemId, input); else await createListItem(list.id, input);
      resetItemEditor(); await refresh();
    } catch (error) { Alert.alert(editingItemId ? 'Couldn’t update item' : 'Couldn’t add item', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function toggle(item: CoupleListItem) {
    const completed = !item.completed;
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, completed } : candidate));
    try { await updateListItem(item.id, { completed }); }
    catch (error) { await refresh(); Alert.alert('Couldn’t update item', messageFrom(error)); }
  }
  async function saveListSettings() {
    if (!list || !renameTitle.trim()) return;
    setBusy(true);
    try { await updateList(list.id, { title: renameTitle.trim(), tagIds: selectedTags }); setSettingsOpen(false); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update list', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function deleteItemConfirmed() {
    const target = deleteItemTarget; setDeleteItemTarget(null); if (!target) return;
    try { await deleteListItem(target.id); setItems((current) => current.filter((candidate) => candidate.id !== target.id)); }
    catch (error) { Alert.alert('Couldn’t delete item', messageFrom(error)); }
  }
  async function deleteListConfirmed() {
    if (!list) return; setDeleteListOpen(false);
    try { await deleteList(list.id); router.replace('/features/lists' as never); }
    catch (error) { Alert.alert('Couldn’t delete list', messageFrom(error)); }
  }

  function renderItem(item: CoupleListItem) {
    const creatorColor = colorForUser(item.creator_id); const palette = creatorColor === 'both' ? null : participantPalettes[creatorColor];
    return (
      <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.border, opacity: item.completed ? 0.62 : 1 }}>
        <Pressable accessibilityRole="checkbox" onPress={() => toggle(item)} accessibilityState={{ checked: item.completed }} style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: palette?.accent ?? theme.colors.textMuted, backgroundColor: item.completed ? (palette?.accentSoft ?? theme.colors.elevatedBackground) : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}><AppText variant="caption" style={{ color: palette?.accent ?? theme.colors.textMuted }}>{item.completed ? '✓' : ''}</AppText></Pressable>
        <Pressable accessibilityRole="button" onPress={() => editItem(item)} style={{ flex: 1, gap: 4 }}>
          <AppText style={{ textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.title}</AppText>
          <ParticipantAttribution userId={item.creator_id} />
          {item.notes ? <AppText variant="bodySmall" tone="secondary">{item.notes}</AppText> : null}
          {item.link ? <Pressable accessibilityRole="button" onPress={(event) => { event.stopPropagation(); Linking.openURL(item.link as string).catch(() => undefined); }}><AppText variant="bodySmall" tone="accent">Open link ↗</AppText></Pressable> : null}
        </Pressable>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>{item.priority !== 'normal' ? <TagChip subtle label={item.priority.toUpperCase()} /> : null}<Pressable accessibilityRole="button" onPress={() => setDeleteItemTarget(item)} hitSlop={8}><AppText tone="muted">•••</AppText></Pressable></View>
      </View>
    );
  }

  if (loading) return <AppScreen><BackHeader eyebrow="Lists" title="Loading…" /></AppScreen>;
  if (!list) return <AppScreen><BackHeader eyebrow="Lists" title="List unavailable" /><Card tone="secondary"><AppText tone="secondary">This list may have been deleted or you may not have access to it.</AppText></Card></AppScreen>;

  return (
    <AppScreen>
      <BackHeader eyebrow="Lists" title={list.title} subtitle={`${items.length} items · ${completedItems.length} completed`} />
      <Card participantColor={colorForUser(list.creator_id)} style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
        <ParticipantAttribution userId={list.creator_id} />
        {(list.tags ?? []).length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(list.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View> : null}
        <Pressable accessibilityRole="button" onPress={() => setSettingsOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}><AppText variant="bodySmall" tone="accent">List settings</AppText><AppText tone="muted">{settingsOpen ? '⌃' : '⌄'}</AppText></Pressable>
        {settingsOpen ? <View style={{ gap: theme.spacing.md, paddingTop: theme.spacing.sm }}><FormField label="LIST NAME" value={renameTitle} onChangeText={setRenameTitle} /><TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} /><View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton label={busy ? 'Saving…' : 'Save list'} disabled={busy || !renameTitle.trim()} onPress={saveListSettings} /></View><AppButton compact variant="danger" label="Delete list" onPress={() => setDeleteListOpen(true)} /></View></View> : null}
      </Card>

      <CollapsibleComposer title={editingItemId ? 'Edit item' : 'Items'} subtitle={`${openItems.length} still to do`} open={composerOpen} actionLabel="Add item" closeLabel={editingItemId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => composerOpen ? resetItemEditor() : setComposerOpen(true)}>
        <FormField label="ITEM" value={itemTitle} onChangeText={setItemTitle} placeholder="Passport" />
        <Pressable accessibilityRole="button" onPress={() => setMoreOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}><AppText variant="bodySmall" tone="accent">{moreOpen ? 'Hide options' : 'More options'}</AppText><AppText tone="muted">{moreOpen ? '⌃' : '⌄'}</AppText></Pressable>
        {moreOpen ? <View style={{ gap: theme.spacing.lg }}><FormField label="NOTES · OPTIONAL" value={itemNotes} onChangeText={setItemNotes} placeholder="Put it in the carry-on" /><FormField label="LINK · OPTIONAL" value={itemLink} onChangeText={setItemLink} placeholder="https://…" autoCapitalize="none" /><View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">PRIORITY</AppText><ChoiceChips value={itemPriority} onChange={setItemPriority} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} /></View></View> : null}
        <AppButton label={busy ? 'Saving…' : editingItemId ? 'Save item' : 'Add item'} disabled={busy || !itemTitle.trim()} onPress={saveItem} />
      </CollapsibleComposer>

      <Card style={{ gap: 0, marginBottom: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: theme.spacing.sm }}><AppText variant="section">To do</AppText><AppText variant="bodySmall" tone="muted">{openItems.length}</AppText></View>
        {openItems.length ? openItems.map(renderItem) : <AppText variant="bodySmall" tone="secondary">Everything on this list is done.</AppText>}
      </Card>

      {completedItems.length ? <Card tone="secondary" style={{ gap: completedOpen ? theme.spacing.sm : 0 }}><Pressable accessibilityRole="button" onPress={() => setCompletedOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><AppText variant="cardTitle">Completed ({completedItems.length})</AppText><AppText tone="muted">{completedOpen ? '⌃' : '⌄'}</AppText></Pressable>{completedOpen ? completedItems.map(renderItem) : null}</Card> : null}

      <ConfirmDialog visible={deleteListOpen} title="Delete this list?" body={`Delete “${list.title}” and all ${items.length} items inside it?`} onCancel={() => setDeleteListOpen(false)} onConfirm={() => deleteListConfirmed().catch(() => undefined)} />
      <ConfirmDialog visible={!!deleteItemTarget} title="Delete item?" body={deleteItemTarget ? `Delete “${deleteItemTarget.title}”?` : ''} onCancel={() => setDeleteItemTarget(null)} onConfirm={() => deleteItemConfirmed().catch(() => undefined)} />
    </AppScreen>
  );
}
