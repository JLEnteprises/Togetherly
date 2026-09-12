import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { offlineStatus, subscribeOffline, retryOfflineChanges, discardOfflineChanges } from '@/services/backend/api';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { useAppTheme } from '@/theme/useAppTheme';

export function OfflineStatus() {
  const theme = useAppTheme();
  const [state, setState] = useState(offlineStatus);
  const [review, setReview] = useState(false);
  useEffect(() => subscribeOffline(() => setState(offlineStatus())), []);
  if (!state.offline && !state.pending) return null;
  return <View style={{ gap: 6, padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: theme.colors.elevatedBackground }}>
    <AppText variant="bodySmall">{state.pending ? `${state.pending} change${state.pending === 1 ? '' : 's'} saved on this device` : 'Offline · showing saved information'}</AppText>
    {state.pending ? <AppText variant="caption" tone="muted">{state.problem ? 'A change needs review before syncing can continue.' : 'Waiting to sync. Your partner will see shared changes after they sync.'}</AppText> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {!state.problem ? <AppButton compact variant="ghost" label="Retry sync" onPress={() => { void retryOfflineChanges().catch(() => undefined); }} /> : null}
      {state.pending ? <AppButton compact variant="ghost" label={review ? 'Hide changes' : 'Review changes'} onPress={() => setReview(!review)} /> : null}
    </View>
    {review ? <View style={{ gap: 8 }}>
      {state.operations.map(op => <View key={op.id} style={{ gap: 3 }}>
        <AppText variant="bodySmall" selectable>{op.kind}: {op.optimistic.title || op.optimistic.mood || 'Saved change'}</AppText>
        {op.method === 'DELETE' ? <AppText variant="caption">Pending deletion</AppText> : null}
        {op.optimistic.description ? <AppText variant="bodySmall" selectable>{op.optimistic.description}</AppText> : null}
        {op.optimistic.body ? <AppText variant="bodySmall" selectable>{op.optimistic.body}</AppText> : null}
        {op.optimistic.context ? <AppText variant="bodySmall" selectable>{op.optimistic.context}</AppText> : null}
        {op.kind === 'task' ? <AppText variant="caption">Status: {op.optimistic.status.replaceAll('_', ' ')}</AppText> : null}
        {op.kind === 'subtask' ? <AppText variant="caption">{op.optimistic.completed ? 'Step done' : 'Step not done'}</AppText> : null}
        {op.kind === 'mood' ? <AppText variant="caption">{op.optimistic.visibility} · {op.optimistic.need}</AppText> : null}
        {op.blocked ? <AppText variant="caption" tone="error">{op.blocked}</AppText> : null}
      </View>)}
      <AppButton compact variant="ghost" label="Discard pending changes" onPress={() => Alert.alert('Discard unsynced changes?', 'These changes have not been confirmed by the server. Copy anything you want to keep first. Already accepted changes remain on the server.', [
        {text:'Keep changes',style:'cancel'}, {text:'Discard pending',style:'destructive',onPress:()=>{ void discardOfflineChanges().catch(error=>Alert.alert('Couldn’t discard',String(error))); }},
      ])} />
    </View> : null}
  </View>;
}
