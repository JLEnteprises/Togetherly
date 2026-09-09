import { parseLocalDateTimeInput } from '@/utils/dates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { FormField } from '@/components/common/FormField';
import { DatePickerField } from '@/components/common/DatePickerField';
import { TimePickerField } from '@/components/common/TimePickerField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { ComposerSheet } from '@/components/common/ComposerSheet';
import { DataStatus } from '@/components/common/DataStatus';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { getActivities } from '@/services/backend/mvpFeatures';
import { getDateProposals, proposeDate, respondToDate, type DateProposal } from '@/services/backend/experience';
import { formatInZone, localDateKey, requestId } from '@/utils/experience';
import type { CoupleActivity } from '@/types/database';

export default function DatePlansScreen() {
  const { profile, partnerProfile } = useWorkspace();
  const params = useLocalSearchParams<{ startAt?: string; endAt?: string }>();
  const [plans, setPlans] = useState<DateProposal[]>([]);
  const [ideas, setIdeas] = useState<CoupleActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [counter, setCounter] = useState<DateProposal | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateKey(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState('18:00');
  const [minutes, setMinutes] = useState('60');
  const creationId = useRef(requestId());
  const handledSlot = useRef('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setPlans(await getDateProposals()); setFailed(false); }
    catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useRealtimeRefresh('date_proposals', refresh);
  useEffect(() => { getActivities().then(setIdeas).catch(() => undefined); }, []);
  function setStart(value: string) {
    const start = new Date(value);
    if (!Number.isFinite(start.getTime())) return;
    setDate(localDateKey(start)); setTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
  }
  useEffect(() => {
    if (!params.startAt || handledSlot.current === params.startAt) return;
    handledSlot.current = params.startAt;
    setStart(params.startAt);
    const duration = params.endAt ? Math.floor((Date.parse(params.endAt) - Date.parse(params.startAt)) / 60000) : 60;
    setMinutes(String(Math.min(60, Math.max(15, duration)))); setOpen(true);
  }, [params.startAt, params.endAt]);
  const start = new Date(parseLocalDateTimeInput(`${date} ${time}`) || NaN);
  const end = new Date(start.getTime() + Number(minutes) * 60000);
  const valid = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime());
  const suggestions = ideas.filter((idea) => idea.status !== 'skip' && idea.duration_minutes && idea.duration_minutes <= Number(minutes)).slice(0, 4);
  function reset() { setTitle(''); setCounter(null); setOpen(false); creationId.current = requestId(); }
  async function submit() {
    if (!valid || !title.trim() || busy) return;
    setBusy(true);
    try {
      const input = { title: title.trim(), startAt: start.toISOString(), endAt: end.toISOString() };
      if (counter) await respondToDate(counter.id, counter.revision, 'counter', input);
      else await proposeDate({ id: creationId.current, ...input });
      reset(); await refresh();
    } catch (error) { Alert.alert('Couldn’t send proposal', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function respond(plan: DateProposal, action: 'accept' | 'decline' | 'cancel') {
    if (busy) return;
    setBusy(true);
    try { await respondToDate(plan.id, plan.revision, action); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update the plan', error instanceof Error ? error.message : 'Please try again.'); await refresh(); }
    finally { setBusy(false); }
  }
  const sorted = [...plans].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || Date.parse(b.start_at) - Date.parse(a.start_at));
  return <AppScreen>
    <BackHeader title="Time together" subtitle="Find a time, suggest a date, and agree together." />
    <View style={{ gap: 16 }}>
      <AppButton variant="secondary" label="Find when we’re both free" onPress={() => router.push('/features/availability')} />
      <ComposerSheet title={counter ? 'Suggest another time' : 'Plan a little time together'} open={open} onToggle={() => setOpen(!open)} dirty={Boolean(title)} onDiscard={reset} busy={busy} actionLabel="Propose a date">
        <FormField label="What shall we do?" value={title} onChangeText={setTitle} maxLength={200} placeholder="Dinner and a movie" />
        <DatePickerField label="DATE · YOUR DEVICE TIME" value={date} onChange={setDate} />
        <TimePickerField label="START · YOUR DEVICE TIME" value={time} onChange={setTime} />
        <AppText variant="bodySmall">How much time?</AppText>
        <ChoiceChips value={minutes} onChange={setMinutes} options={Array.from(new Set([minutes, '30', '60', '90', '120'])).map((value) => ({ value, label: `${value} min` }))} />
        {valid ? <Card style={{ gap: 8 }}>
          <AppText variant="bodySmall">{profile?.display_name}: {formatInZone(start.toISOString(), profile?.timezone)} – {formatInZone(end.toISOString(), profile?.timezone)}</AppText>
          {partnerProfile ? <AppText variant="bodySmall">{partnerProfile.display_name}: {formatInZone(start.toISOString(), partnerProfile.timezone)} – {formatInZone(end.toISOString(), partnerProfile.timezone)}</AppText> : null}
        </Card> : null}
        {suggestions.length ? <View style={{ gap: 8 }}><AppText variant="bodySmall" tone="secondary">Saved ideas that fit this duration</AppText>{suggestions.map((idea) => <AppButton key={idea.id} compact variant="secondary" label={idea.title} onPress={() => setTitle(idea.title)} />)}</View> : null}
        <AppText variant="bodySmall" tone="secondary">Your partner can accept or suggest a different time. An accepted plan is added to your shared calendar. Check recurring events before agreeing.</AppText>
        <AppButton label={busy ? 'Sending…' : 'Send proposal'} disabled={busy || !title.trim() || !valid || !partnerProfile} onPress={submit} />
        {!partnerProfile ? <AppText tone="muted">Invite your partner to start planning together.</AppText> : null}
      </ComposerSheet>
      <DataStatus loading={loading} error={failed} retry={() => { void refresh(); }} />
      {!loading && !failed && !plans.length ? <AppText tone="secondary">Your first plan can be as simple as a 30-minute call.</AppText> : null}
      {sorted.map((plan) => {
        const mine = plan.proposer_id === profile?.id;
        const past = Date.parse(plan.end_at) < Date.now();
        return <Card key={plan.id} style={{ gap: 12 }}>
          <AppText variant="caption" tone="secondary">{plan.status === 'pending' ? mine ? 'WAITING FOR YOUR PARTNER' : 'YOUR PARTNER SUGGESTED' : plan.status.toUpperCase()}</AppText>
          <AppText variant="section">{plan.title}</AppText>
          <AppText variant="bodySmall">{profile?.display_name}: {formatInZone(plan.start_at, profile?.timezone)} – {formatInZone(plan.end_at, profile?.timezone)}</AppText>
          {partnerProfile ? <AppText variant="bodySmall" tone="secondary">{partnerProfile.display_name}: {formatInZone(plan.start_at, partnerProfile.timezone)} – {formatInZone(plan.end_at, partnerProfile.timezone)}</AppText> : null}
          {plan.status === 'pending' ? <View style={{ gap: 8 }}>
            {!mine ? <><AppButton label="It’s a date ♥" disabled={busy || Date.parse(plan.start_at) <= Date.now()} onPress={() => { void respond(plan, 'accept'); }} /><AppButton variant="secondary" label="Suggest another time" disabled={busy} onPress={() => { setCounter(plan); setTitle(plan.title); setStart(plan.start_at); setMinutes(String(Math.round((Date.parse(plan.end_at) - Date.parse(plan.start_at)) / 60000))); setOpen(true); }} /><AppButton variant="ghost" label="Not this time" disabled={busy} onPress={() => { void respond(plan, 'decline'); }} /></> : <AppButton variant="ghost" label="Withdraw proposal" disabled={busy} onPress={() => { void respond(plan, 'cancel'); }} />}
            {Date.parse(plan.start_at) <= Date.now() ? <AppText tone="muted">This time has passed. You can suggest another.</AppText> : null}
          </View> : null}
          {plan.event_id ? <AppButton variant="secondary" label="Open calendar event" onPress={() => router.push(`/features/calendar?focus=${plan.event_id}` as never)} /> : null}
          {plan.status === 'accepted' && plan.event_id && past ? <AppButton label="Keep a little of this day" onPress={() => router.push(`/features/memories?sourceEvent=${plan.event_id}` as never)} /> : null}
        </Card>;
      })}
    </View>
  </AppScreen>;
}
