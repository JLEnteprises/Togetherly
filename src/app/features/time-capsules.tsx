import { parseLocalDateTimeInput } from '@/utils/dates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { ComposerSheet } from '@/components/common/ComposerSheet';
import { FormField } from '@/components/common/FormField';
import { DatePickerField } from '@/components/common/DatePickerField';
import { TimePickerField } from '@/components/common/TimePickerField';
import { PhotoPickerField } from '@/components/common/PhotoPickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataStatus } from '@/components/common/DataStatus';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { createCapsule, deleteCapsule, getCapsules, type TimeCapsule } from '@/services/backend/experience';
import { formatInZone, localDateKey, requestId } from '@/utils/experience';
export default function TimeCapsulesScreen() {
  const { profile, partnerProfile } = useWorkspace();
  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [date, setDate] = useState(localDateKey(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState('09:00');
  const [deleting, setDeleting] = useState<TimeCapsule | null>(null);
  const id = useRef(requestId());
  const refresh = useCallback(async () => {
    try { setCapsules(await getCapsules()); setError(false); } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); const timer = setInterval(() => { void refresh(); }, 60000); return () => clearInterval(timer); }, [refresh]));
  useRealtimeRefresh('time_capsules', refresh);
  function reset() { setTitle(''); setBody(''); setPhoto(null); setOpen(false); id.current = requestId(); }
  const opens = new Date(parseLocalDateTimeInput(`${date} ${time}`) || NaN);
  const valid = Number.isFinite(opens.getTime());
  async function seal() {
    if (!valid || busy) return;
    setBusy(true);
    try { await createCapsule({ id: id.current, title, body, photoUrl: photo, opensAt: opens.toISOString() }); reset(); await refresh(); }
    catch (error) { Alert.alert('Couldn’t seal your capsule', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try { await deleteCapsule(deleting.id); setDeleting(null); await refresh(); }
    catch (error) { Alert.alert('Couldn’t delete capsule', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <AppScreen>
    <BackHeader title="Open together" subtitle="A note or photo for a future moment. No streaks, no catching up." />
    <View style={{ gap: 16 }}>
      <ComposerSheet title="Something for later" open={open} onToggle={() => setOpen(!open)} dirty={Boolean(title || body || photo)} onDiscard={reset} busy={busy} actionLabel="Make a capsule">
        <FormField label="Title · visible before opening" value={title} onChangeText={setTitle} maxLength={200} placeholder="For our next anniversary" />
        <FormField label="A note to open later" value={body} onChangeText={setBody} multiline maxLength={5000} />
        <PhotoPickerField label="PHOTO · OPTIONAL" value={photo} onChange={setPhoto} />
        <DatePickerField label="OPENING DATE · YOUR DEVICE TIME" value={date} onChange={setDate} />
        <TimePickerField label="OPENING TIME · YOUR DEVICE TIME" value={time} onChange={setTime} />
        {valid ? <><AppText variant="bodySmall">{profile?.display_name}: {formatInZone(opens.toISOString(), profile?.timezone)}</AppText>{partnerProfile ? <AppText variant="bodySmall">{partnerProfile.display_name}: {formatInZone(opens.toISOString(), partnerProfile.timezone)}</AppText> : null}</> : null}
        <AppText tone="secondary" variant="bodySmall">Once sealed, neither of you can open the contents until this time. You can delete your capsule. Refresh this screen when it’s time to open.</AppText>
        <AppButton label={busy ? 'Sealing…' : 'Seal for later'} disabled={busy || !valid || !title.trim() || (!body.trim() && !photo)} onPress={seal} />
      </ComposerSheet>
      <DataStatus loading={loading} error={error} retry={() => { void refresh(); }} />
      <AppButton compact variant="ghost" label="Refresh capsules" onPress={() => { void refresh(); }} />
      {!loading && !error && !capsules.length ? <AppText tone="secondary">Save a tiny surprise for a day you’re looking forward to.</AppText> : null}
      {capsules.map((capsule) => <Card key={capsule.id} style={{ gap: 12 }}>
        <AppText variant="caption" tone="secondary">{capsule.opened ? 'READY TO OPEN' : 'SEALED UNTIL'} · {formatInZone(capsule.opens_at, profile?.timezone)}</AppText>
        <AppText variant="section">{capsule.title}</AppText>
        {capsule.opened ? <>{capsule.photo_url ? <Image source={{ uri: capsule.photo_url }} accessibilityLabel={capsule.title} style={{ width: '100%', height: 240, borderRadius: 16 }} resizeMode="cover" /> : null}{capsule.body ? <AppText>{capsule.body}</AppText> : null}</> : <AppText tone="muted">A little surprise is waiting for you both.</AppText>}
        {capsule.creator_id === profile?.id ? <AppButton compact variant="ghost" label="Delete my capsule" disabled={busy} onPress={() => setDeleting(capsule)} /> : null}
      </Card>)}
      <ConfirmDialog visible={Boolean(deleting)} title="Delete this capsule?" body="Its note and photo will be removed from this capsule." onCancel={() => setDeleting(null)} onConfirm={() => { void remove(); }} />
    </View>
  </AppScreen>;
}
