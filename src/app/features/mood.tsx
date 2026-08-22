import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { createMood, getLatestMoods } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { MoodEntry, MoodValue, NeedValue } from '@/types/database';

const moodLabels: Record<MoodValue, string> = { amazing: '😄 Amazing', good: '🙂 Good', okay: '😐 Okay', low: '😔 Low', frustrated: '😡 Frustrated', overwhelmed: '😫 Overwhelmed', tired: '😴 Tired', stressed: '😰 Stressed' };
const needLabels: Record<NeedValue, string> = { affection: 'Affection', reassurance: 'Reassurance', advice: 'Advice', listen: 'Listen to me', distraction: 'Distraction', space: 'Space', call: 'Call me', nothing: 'Nothing' };
function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function relative(entry: MoodEntry | null) { if (!entry) return ''; const mins = Math.max(0, Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60000)); return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`; }

export default function MoodScreen() {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  const [mood, setMood] = useState<MoodValue>('okay');
  const [need, setNeed] = useState<NeedValue>('nothing');
  const [visibility, setVisibility] = useState<'shared' | 'private'>('shared');
  const [mine, setMine] = useState<MoodEntry | null>(null);
  const [partner, setPartner] = useState<MoodEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { const next = await getLatestMoods(); setMine(next.mine); setPartner(next.partner); }
    catch (error) { Alert.alert('Couldn’t load check-ins', messageFrom(error)); }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('moods', refresh);

  async function save() {
    setBusy(true);
    try { await createMood({ mood, need, visibility }); await refresh(); }
    catch (error) { Alert.alert('Couldn’t save check-in', messageFrom(error)); }
    finally { setBusy(false); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Mood check-in" subtitle="Share how you feel and what you need." />
      <Card participantColor={myColor} style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
        <AppText variant="caption" style={{ color: participantPalettes[myColor].accent }}>{profile!.display_name.toUpperCase()}</AppText>
        <AppText variant="section">How are you feeling?</AppText>
        <ChoiceChips value={mood} onChange={setMood} options={(Object.keys(moodLabels) as MoodValue[]).map((value) => ({ value, label: moodLabels[value] }))} />
        <AppText variant="section">What do you need?</AppText>
        <ChoiceChips value={need} onChange={setNeed} options={(Object.keys(needLabels) as NeedValue[]).map((value) => ({ value, label: needLabels[value] }))} />
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">VISIBILITY</AppText><ChoiceChips value={visibility} onChange={setVisibility} options={[{ value: 'shared', label: '♥ Shared' }, { value: 'private', label: '🔒 Private' }]} /></View>
        <AppButton label={busy ? 'Saving…' : 'Save check-in'} disabled={busy} onPress={save} />
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="section">Latest</AppText>
        {mine ? <Card participantColor={myColor} style={{ gap: 7 }}><AppText variant="caption" style={{ color: participantPalettes[myColor].accent }}>{profile!.display_name.toUpperCase()} · {relative(mine).toUpperCase()}</AppText><AppText variant="section">{moodLabels[mine.mood]}</AppText><TagChip participantColor={myColor} label={`NEEDS: ${needLabels[mine.need].toUpperCase()}`} />{mine.visibility === 'private' ? <TagChip subtle label="PRIVATE" /> : null}</Card> : null}
        {partner ? <Card participantColor={partnerColor} style={{ gap: 7 }}><AppText variant="caption" style={{ color: participantPalettes[partnerColor].accent }}>{partnerProfile?.display_name?.toUpperCase() ?? 'SHARED'} · {relative(partner).toUpperCase()}</AppText><AppText variant="section">{moodLabels[partner.mood]}</AppText><TagChip participantColor={partnerColor} label={`NEEDS: ${needLabels[partner.need].toUpperCase()}`} /></Card> : <Card tone="secondary"><AppText tone="secondary">{partnerProfile ? `${partnerProfile.display_name} hasn’t shared a check-in yet. Private check-ins never appear here.` : 'Invite your partner to share check-ins together.'}</AppText></Card>}
      </View>
    </AppScreen>
  );
}
