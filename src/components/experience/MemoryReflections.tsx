import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { DataStatus } from '@/components/common/DataStatus';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { getReflections, saveReflection, type Reflection } from '@/services/backend/experience';
export function MemoryReflections({ memoryId }: { memoryId: string }) {
  const { profile } = useWorkspace();
  const [items, setItems] = useState<Reflection[]>([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try { setItems(await getReflections(memoryId)); setError(false); }
    catch { setError(true); }
  }, [memoryId]);
  useEffect(() => { void refresh(); }, [refresh]); useRealtimeRefresh('memories', refresh);
  async function save() {
    if (busy) return;
    setBusy(true);
    try { await saveReflection(memoryId, draft); setEditing(false); setDraft(''); await refresh(); }
    catch (error) { Alert.alert('Couldn’t save your words', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <AppText variant="section">What we remember</AppText>
    <DataStatus error={error} retry={() => { void refresh(); }} />
    {items.map((item) => <View key={item.user_id} style={{ gap: 4 }}><ParticipantAttribution userId={item.user_id} /><AppText>{item.body}</AppText></View>)}
    {editing ? <><FormField label="Your words · shared with your partner" value={draft} onChangeText={setDraft} multiline maxLength={2000} /><AppButton label={busy ? 'Saving…' : 'Save my words'} disabled={busy || !draft.trim()} onPress={save} /><AppButton variant="ghost" label="Keep draft & close" disabled={busy} onPress={() => setEditing(false)} /></> : <AppButton variant="secondary" label="Add my side of the memory" onPress={() => { setDraft(draft || items.find((item) => item.user_id === profile?.id)?.body || ''); setEditing(true); }} />}
  </View>;
}
