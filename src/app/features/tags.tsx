import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { EmptyState } from '@/components/common/EmptyState';
import { IconButton } from '@/components/common/IconButton';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { DrawingCanvas, DrawnIcon } from '@/components/common/DrawingCanvas';
import { bootstrapTags, createTag, deleteTag, getTags, updateTag } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { DrawingData, DrawingStroke, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function TagsScreen() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [iconDrawing, setIconDrawing] = useState<DrawingData | null>(null);
  const [drawingOpen, setDrawingOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setTags(await getTags()); }
    catch (error) { Alert.alert('Couldn’t load tags', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('tags', refresh);

  function resetForm(close = true) { setEditingId(null); setName(''); setIcon(''); setIconDrawing(null); setDrawingOpen(false); if (close) setComposerOpen(false); }
  function edit(tag: Tag) { setEditingId(tag.id); setName(tag.name); setIcon(tag.icon ?? ''); setIconDrawing(tag.icon_drawing ?? null); setDrawingOpen(false); setComposerOpen(true); }
  function addIconStroke(stroke: DrawingStroke) { setIconDrawing((current) => ({ version: 1, strokes: [...(current?.strokes ?? []), { ...stroke, userId: undefined }].slice(-32) })); }
  function undoIconStroke() { setIconDrawing((current) => current ? { version: 1, strokes: current.strokes.slice(0, -1) } : null); }
  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editingId) await updateTag(editingId, { name: name.trim(), icon: icon.trim() || null, iconDrawing: iconDrawing?.strokes.length ? iconDrawing : null });
      else await createTag(name.trim(), icon.trim() || undefined, iconDrawing?.strokes.length ? iconDrawing : null);
      resetForm();
      await refresh();
    }
    catch (error) { Alert.alert(editingId ? 'Couldn’t update tag' : 'Couldn’t add tag', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function starterSet() {
    setBusy(true);
    try { setTags(await bootstrapTags()); }
    catch (error) { Alert.alert('Couldn’t add starter tags', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    try { await deleteTag(id); setTags((current) => current.filter((tag) => tag.id !== id)); }
    catch (error) { Alert.alert('Couldn’t delete tag', messageFrom(error)); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Plan" title="Tags" subtitle="Labels for plans, memories and more." />
      <CollapsibleComposer title={editingId ? 'Edit tag' : 'Our tags'} subtitle={`${tags.length} reusable labels`} open={composerOpen} actionLabel="New tag" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
          <View style={{ width: 90 }}><FormField label="ICON" value={icon} onChangeText={setIcon} maxLength={8} placeholder="🌿" /></View>
          <View style={{ flex: 1 }}><FormField label="NAME" value={name} onChangeText={setName} placeholder="Outdoors" /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}><AppButton compact variant="secondary" label={drawingOpen ? 'Close drawing' : iconDrawing?.strokes.length ? 'Edit drawn icon' : 'Draw icon'} onPress={() => setDrawingOpen((value) => !value)} />{iconDrawing?.strokes.length ? <View style={{ width: 36, height: 36, borderRadius: 9, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}><DrawnIcon strokes={iconDrawing.strokes} size={24} /></View> : null}{iconDrawing?.strokes.length ? <AppButton compact variant="ghost" label="Remove drawing" onPress={() => setIconDrawing(null)} /> : null}</View>
        {drawingOpen ? <View style={{ gap: theme.spacing.sm, alignSelf: 'flex-start', width: 190, maxWidth: '100%' }}><DrawingCanvas strokes={iconDrawing?.strokes ?? []} editable onStroke={addIconStroke} height={190} /><View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><AppButton compact variant="ghost" label="Undo" disabled={!iconDrawing?.strokes.length} onPress={undoIconStroke} /><AppButton compact variant="ghost" label="Clear" disabled={!iconDrawing?.strokes.length} onPress={() => setIconDrawing(null)} /></View><AppText variant="bodySmall" tone="muted">Draw a simple icon.</AppText></View> : null}
        <AppButton label={busy ? 'Saving…' : editingId ? 'Save tag' : 'Add tag'} disabled={busy || !name.trim()} onPress={add} />
        <AppButton label="Add starter tag set" variant="ghost" disabled={busy} onPress={starterSet} />
      </CollapsibleComposer>
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="section">Our tags</AppText>
        {loading ? <AppText tone="muted">Loading tags…</AppText> : null}
        {!loading && tags.length === 0 ? <EmptyState icon="tag" title="No tags yet" body="Create a tag or add the starter set." actionLabel="Add starter tags" onAction={starterSet} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
          {tags.map((tag) => (
            <Pressable key={tag.id} accessibilityRole="button" accessibilityHint="Tap to edit. Long press to delete this tag." onLongPress={() => remove(tag.id)} onPress={() => edit(tag)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 3, borderLeftColor: colorForUser(tag.creator_id) === 'purple' ? theme.participantPalettes.purple.accent : colorForUser(tag.creator_id) === 'green' ? theme.participantPalettes.green.accent : theme.colors.textMuted, backgroundColor: theme.colors.card, paddingHorizontal: 13, paddingVertical: 9, opacity: pressed ? 0.72 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>{tag.icon_drawing?.strokes?.length ? <DrawnIcon strokes={tag.icon_drawing.strokes} size={17} /> : tag.icon ? <AppText>{tag.icon}</AppText> : null}<AppText>{tag.name}</AppText></View><IconButton icon="close" label={`Delete ${tag.name}`} onPress={() => remove(tag.id)} />
            </Pressable>
          ))}
        </View>
      </View>
    </AppScreen>
  );
}
