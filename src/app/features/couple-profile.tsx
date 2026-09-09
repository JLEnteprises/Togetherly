import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { DatePickerField } from '@/components/common/DatePickerField';
import { Avatar } from '@/components/common/Avatar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { deleteCoupleSpace, leaveCouple, removePartner, updateCouple } from '@/services/backend/workspace';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function initial(name: string | undefined) { return name?.trim()?.slice(0,1).toUpperCase() || '♡'; }
type ConfirmAction = 'leave' | 'remove' | 'delete' | null;

export default function CoupleProfileScreen() {
  const theme = useAppTheme();
  const { couple, profile, partnerProfile, myColor, partnerColor, refresh } = useWorkspace();
  const [startDate, setStartDate] = useState(''); const [distance, setDistance] = useState<'yes' | 'no'>('yes'); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const isOwner = Boolean(couple?.owner_user_id && couple.owner_user_id === profile?.id);

  useEffect(() => { setStartDate(couple?.relationship_start_date ?? ''); setDistance(couple?.long_distance_enabled ? 'yes' : 'no'); }, [couple?.long_distance_enabled, couple?.relationship_start_date]);

  async function save() {
    setBusy(true);
    try { await updateCouple({ relationshipStartDate: startDate || null, longDistanceEnabled: distance === 'yes' }); await refresh(); Alert.alert('Saved', 'Your relationship details have been updated.'); }
    catch (error) { Alert.alert('Couldn’t save', messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function performConfirmed() {
    const action = confirm; setConfirm(null); if (!action) return; setBusy(true);
    try {
      if (action === 'leave') await leaveCouple();
      if (action === 'remove') await removePartner();
      if (action === 'delete') await deleteCoupleSpace();
      await refresh();
    } catch (error) { Alert.alert('Couldn’t update your couple space', messageFrom(error)); }
    finally { setBusy(false); }
  }

  const confirmCopy = confirm === 'leave'
    ? { title: 'Leave this couple space?', body: 'Your private notes and check-ins in this space are removed. Shared history stays with the remaining account.', label: 'Leave space' }
    : confirm === 'remove'
      ? { title: `Unlink ${partnerProfile?.display_name ?? 'this account'}?`, body: 'They will lose access to this shared space. Shared history stays here and they can create or join another space later.', label: 'Unlink account' }
      : { title: 'Delete this couple space?', body: 'This permanently deletes the shared tasks, lists, notes, memories, events, goals, trips, countdowns and activities for both accounts. This cannot be undone.', label: 'Delete space' };

  return <AppScreen>
    <BackHeader eyebrow="More" title="Couple profile" subtitle="Relationship details and settings." />
    <Card participantColor="both" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
      {/* E3_PAIRED_COUPLE_IDENTITY */}
      <CoupleIdentitySignature detail="Two accounts · one shared relationship space." />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}><Avatar initials={initial(profile?.display_name)} imageUrl={profile?.avatar_url} size={54} participantColor={myColor} /><View style={{ flex:1 }}><AppText variant="section">{profile?.display_name}</AppText><AppText variant="caption" tone="muted">{profile?.timezone}</AppText></View></View>
      {partnerProfile ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}><Avatar initials={initial(partnerProfile.display_name)} imageUrl={partnerProfile.avatar_url} size={54} participantColor={partnerColor} /><View style={{ flex:1 }}><AppText variant="section">{partnerProfile.display_name}</AppText><AppText variant="caption" tone="muted">{partnerProfile.timezone}</AppText></View></View> : <AppText tone="secondary">Waiting for your partner to join.</AppText>}
    </Card>

    <Card style={{ gap: theme.spacing.lg }}>
      <DatePickerField label="RELATIONSHIP START DATE · OPTIONAL" value={startDate} onChange={setStartDate} optional />
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">LONG DISTANCE</AppText><ChoiceChips value={distance} onChange={setDistance} options={[{ value:'yes', label:'Yes' },{ value:'no', label:'No' }]} /></View>
      <AppButton label={busy ? 'Saving…' : 'Save relationship details'} disabled={busy} onPress={save} />
    </Card>

    <Card tone="secondary" style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.md }}>
      <AppText variant="section">Linked accounts</AppText>
      {partnerProfile ? <AppText tone="secondary">{profile?.display_name} and {partnerProfile.display_name} currently share this space.</AppText> : <AppText tone="secondary">Only {profile?.display_name} is linked right now. Your invite remains available from Home.</AppText>}
      {partnerProfile && isOwner ? <AppButton compact variant="ghost" label={`Unlink ${partnerProfile.display_name}`} disabled={busy} onPress={() => setConfirm('remove')} /> : null}
      <AppButton compact variant="ghost" label="Leave this couple space" disabled={busy} onPress={() => setConfirm('leave')} />
    </Card>

    {isOwner ? <Card style={{ marginTop: theme.spacing.md, gap: theme.spacing.md, borderColor: theme.colors.error }}><AppText variant="section" style={{ color: theme.colors.error }}>Delete shared space</AppText><AppText tone="secondary">Only the space owner can delete all shared relationship data for both accounts.</AppText><AppButton compact variant="danger" label="Delete couple space" disabled={busy} onPress={() => setConfirm('delete')} /></Card> : null}

    <ConfirmDialog visible={confirm !== null} title={confirmCopy.title} body={confirmCopy.body} confirmLabel={confirmCopy.label} onCancel={() => setConfirm(null)} onConfirm={() => performConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
