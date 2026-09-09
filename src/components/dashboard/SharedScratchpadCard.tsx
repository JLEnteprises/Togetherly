import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { DrawingCanvas } from '@/components/common/DrawingCanvas';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { getSharedScratchpad, saveSharedScratchpad, type ScratchpadMode } from '@/services/backend/sharedItems';
import { realtimeClient } from '@/services/backend/realtime';
import type { DrawingData, DrawingStroke, SharedItem } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes, participantPalette } from '@/theme/tokens';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function drawingFromItem(item: SharedItem | null): DrawingData {
  const raw = item?.metadata?.drawing;
  if (!raw || typeof raw !== 'object') return { version: 1, strokes: [] };
  const drawing = raw as Partial<DrawingData>;
  return drawing.version === 1 && Array.isArray(drawing.strokes) ? { version: 1, strokes: drawing.strokes } : { version: 1, strokes: [] };
}

function modeFromItem(item: SharedItem | null): ScratchpadMode {
  return item?.metadata?.mode === 'draw' ? 'draw' : 'text';
}

function drawingKey(strokes: DrawingStroke[]) { return JSON.stringify(strokes); }

export function SharedScratchpadCard({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  const { couple, profile, myColor, colorForUser } = useWorkspace();
  const [item, setItem] = useState<SharedItem | null>(null);
  const [body, setBody] = useState('');
  const [savedBody, setSavedBody] = useState('');
  const [mode, setMode] = useState<ScratchpadMode>('text');
  const [savedMode, setSavedMode] = useState<ScratchpadMode>('text');
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [savedDrawingKey, setSavedDrawingKey] = useState('[]');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remoteUpdate, setRemoteUpdate] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const dirtyRef = useRef(false);

  const applyItem = useCallback((nextItem: SharedItem | null) => {
    const drawing = drawingFromItem(nextItem);
    const nextMode = modeFromItem(nextItem);
    setItem(nextItem);
    setBody(nextItem?.body ?? '');
    setSavedBody(nextItem?.body ?? '');
    setMode(nextMode);
    setSavedMode(nextMode);
    setStrokes(drawing.strokes);
    setSavedDrawingKey(drawingKey(drawing.strokes));
    setRemoteUpdate(false);
  }, []);

  const load = useCallback(async () => {
    if (!couple?.id) { setLoading(false); return; }
    try { applyItem(await getSharedScratchpad(couple.id)); }
    catch (error) { console.warn('Unable to load shared scratchpad:', messageFrom(error)); }
    finally { setLoading(false); }
  }, [applyItem, couple?.id]);

  useEffect(() => { load().catch(() => undefined); }, [load]);
  useEffect(() => {
    if (!couple?.id) return;
    return realtimeClient.subscribe((event) => {
      if (event.type === 'shared_item.updated' && event.sharedKey === 'scratchpad') {
        if (dirtyRef.current) setRemoteUpdate(true);
        else load().catch(() => undefined);
      }
    });
  }, [couple?.id, load]);

  const currentDrawingKey = useMemo(() => drawingKey(strokes), [strokes]);
  const dirty = body !== savedBody || mode !== savedMode || currentDrawingKey !== savedDrawingKey;
  dirtyRef.current = dirty;

  async function save() {
    if (!couple?.id) return;
    setSaving(true);
    try {
      const nextItem = await saveSharedScratchpad({
        coupleId: couple.id,
        body,
        mode,
        drawing: { version: 1, strokes },
        existingId: item?.id,
      });
      applyItem(nextItem);
      if (compact) setExpanded(false);
    } catch (error) { Alert.alert('Couldn’t save scratchpad', messageFrom(error)); }
    finally { setSaving(false); }
  }

  function addStroke(stroke: DrawingStroke) {
    setStrokes((current) => [...current, stroke].slice(-120));
  }

  function undoMine() {
    setStrokes((current) => {
      const next = [...current];
      let index = -1;
      for (let cursor = next.length - 1; cursor >= 0; cursor -= 1) {
        if (!profile?.id || next[cursor]?.userId === profile.id) { index = cursor; break; }
      }
      if (index >= 0) next.splice(index, 1);
      return next;
    });
  }

  function begin(nextMode: ScratchpadMode) {
    setMode(nextMode);
    setExpanded(true);
  }

  function cancelCompactEdit() {
    applyItem(item);
    setExpanded(false);
  }

  const ownerColor = item ? colorForUser(item.updated_by) : myColor;
  const ownerPalette = ownerColor === 'both' ? null : participantPalette(ownerColor);
  const previewMode = dirty ? mode : savedMode;
  const previewStrokes = dirty ? strokes : drawingFromItem(item).strokes;
  const previewBody = dirty ? body : (item?.body ?? '');

  return (
    <Card participantColor={compact ? 'both' : item ? ownerColor : 'both'} style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="success">SCRATCHPAD</AppText>
          <AppText variant={compact ? 'cardTitle' : 'section'}>{compact ? 'Quick note for both of you' : 'Shared scratchpad'}</AppText>
          {!compact && item ? <ParticipantAttribution userId={item.updated_by} verb="Last edited by" /> : null}
        </View>
        {item ? <AppText variant="caption" tone="muted">{formatSavedAt(item.updated_at)}</AppText> : null}
      </View>

      {compact && !expanded ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Open scratchpad" onPress={() => setExpanded(true)} style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
            {previewMode === 'draw' && previewStrokes.length ? (
              <DrawingCanvas
                strokes={previewStrokes}
                currentUserId={profile?.id}
                editable={false}
                height={86}
                strokeColorForUser={(userId) => {
                  const participant = colorForUser(userId);
                  return participant === 'both' ? theme.colors.accent : participantPalette(participant).accent;
                }}
              />
            ) : (
              <View style={{ minHeight: 58, justifyContent: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 10, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }}>
                <AppText variant="bodySmall" tone={previewBody.trim() ? 'primary' : 'muted'} numberOfLines={2}>{previewBody.trim() || 'Leave a note or sketch…'}</AppText>
              </View>
            )}
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <AppButton compact variant="ghost" label="Text" icon="note" onPress={() => begin('text')} />
            <AppButton compact variant="ghost" label="Draw" icon="draw" onPress={() => begin('draw')} />
            <AppButton compact variant="ghost" label="Open" icon="chevron" onPress={() => router.push('/features/scratchpad' as never)} />
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <AppButton compact variant={mode === 'text' ? 'secondary' : 'ghost'} label="Text" icon="note" onPress={() => setMode('text')} />
            <AppButton compact variant={mode === 'draw' ? 'secondary' : 'ghost'} label="Draw" icon="draw" onPress={() => setMode('draw')} />
          </View>

          {mode === 'text' ? (
            <TextInput
              accessibilityLabel="Shared scratchpad text"
              value={body}
              onChangeText={setBody}
              editable={!loading && !saving}
              multiline
              maxLength={10000}
              placeholder={loading ? 'Loading…' : 'Write something…'}
              placeholderTextColor={theme.colors.textMuted}
              style={{
                minHeight: compact ? 82 : 116,
                maxHeight: compact ? 130 : undefined,
                padding: theme.spacing.md,
                borderRadius: theme.radii.md,
                borderWidth: 1,
                borderColor: dirty ? theme.colors.accent : item ? (ownerPalette?.border ?? theme.colors.border) : theme.colors.border,
                backgroundColor: theme.colors.elevatedBackground,
                color: theme.colors.textPrimary,
                fontSize: 15,
                lineHeight: 22,
                textAlignVertical: 'top',
              }}
            />
          ) : (
            <View style={{ gap: theme.spacing.sm }}>
              <DrawingCanvas
                strokes={strokes}
                currentUserId={profile?.id}
                height={compact ? 150 : 280}
                showTools={!compact}
                onStroke={addStroke}
                strokeColorForUser={(userId) => {
                  const participant = colorForUser(userId);
                  return participant === 'both' ? theme.colors.accent : participantPalette(participant).accent;
                }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <AppButton compact variant="ghost" label="Undo" disabled={!strokes.length || saving} onPress={undoMine} />
                <AppButton compact variant="ghost" label="Clear" disabled={!strokes.length || saving} onPress={() => setStrokes([])} />
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <AppText variant="caption" style={{ color: remoteUpdate ? theme.colors.warning : dirty ? theme.colors.accent : theme.colors.textMuted }}>{remoteUpdate ? 'Updated by partner' : dirty ? 'Unsaved' : ''}</AppText>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {remoteUpdate ? <AppButton compact variant="ghost" label="Reload" onPress={() => load().catch(() => undefined)} /> : null}
              {compact ? <AppButton compact variant="ghost" label={dirty ? 'Cancel' : 'Close'} onPress={cancelCompactEdit} /> : null}
              <AppButton compact label={saving ? 'Saving…' : 'Save'} disabled={saving || loading || !dirty} onPress={save} />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}
