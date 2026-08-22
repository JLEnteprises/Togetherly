import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { FormField } from '@/components/common/FormField';
import { DatePickerField } from '@/components/common/DatePickerField';
import { PhotoPickerField } from '@/components/common/PhotoPickerField';
import { ToggleRow } from '@/components/common/ToggleRow';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { createCoupleWorkspace, joinCoupleWithCode, updateCouple, updateProfile } from '@/services/backend/workspace';
import { refreshCurrentUser } from '@/services/backend/auth';
import { useAuth } from '@/providers/AuthProvider';
import { participantPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ParticipantColor } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
type Stage = 'profile' | 'space' | 'relationship' | 'finish';

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const { profile, partnerProfile, couple, myColor, partnerColor, refresh } = useWorkspace();
  const { signOut } = useAuth();
  const [stage, setStage] = useState<Stage>('profile');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [photo, setPhoto] = useState<string | null>(null);
  const [chosenColor, setChosenColor] = useState<ParticipantColor>('purple');
  const [inviteCode, setInviteCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [longDistance, setLongDistance] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.onboarding_complete ? profile.display_name : profile.display_name === 'New member' ? '' : profile.display_name);
    setTimezone(profile.timezone || detectedTimezone);
    setPhoto(profile.avatar_url);
    setChosenColor(profile.preferred_participant_color ?? myColor ?? 'purple');
    if (couple) {
      setStartDate(couple.relationship_start_date ?? '');
      setLongDistance(Boolean(couple.long_distance_enabled));
    }
    if (profile.onboarding_complete && !couple) setStage('space');
  }, [couple?.id, couple?.relationship_start_date, couple?.long_distance_enabled, detectedTimezone, myColor, profile?.id]);

  async function saveProfileStep() {
    if (!name.trim()) { Alert.alert('What should we call you?', 'Add the name you want your partner to see.'); return; }
    setBusy(true);
    try {
      await updateProfile({ displayName: name.trim(), timezone: timezone.trim(), avatarUrl: photo, onboardingComplete: false });
      setStage(couple ? 'relationship' : 'space');
      void refreshCurrentUser().catch(() => undefined);
      void refresh().catch(() => undefined);
    } catch (error) { Alert.alert('Couldn’t save your profile', messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function createSpace() {
    setBusy(true);
    try {
      await createCoupleWorkspace({ relationshipStartDate: startDate || null, longDistanceEnabled: longDistance, participantColor: chosenColor });
      await refresh();
      setStage('finish');
    } catch (error) { Alert.alert('Couldn’t create your space', messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function joinSpace() {
    setBusy(true);
    try {
      await joinCoupleWithCode(inviteCode);
      await refresh();
      setStage('finish');
    } catch (error) { Alert.alert('Couldn’t join that space', messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function saveRelationship() {
    setBusy(true);
    try {
      if (couple) await updateCouple({ relationshipStartDate: startDate || null, longDistanceEnabled: longDistance });
      setStage('finish');
      await refresh();
    } catch (error) { Alert.alert('Couldn’t save relationship details', messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function finish() {
    setBusy(true);
    try {
      await updateProfile({ onboardingComplete: true });
      await refreshCurrentUser();
      await refresh();
    } catch (error) { Alert.alert('Couldn’t finish setup', messageFrom(error)); }
    finally { setBusy(false); }
  }

  const progress = stage === 'profile' ? '1 OF 3' : stage === 'space' || stage === 'relationship' ? '2 OF 3' : '3 OF 3';

  return (
    <AppScreen contentStyle={{ paddingTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="accent">SETUP · {progress}</AppText>
          <AppText variant="pageTitle">{stage === 'profile' ? 'Make it yours' : stage === 'space' ? 'Find your person' : stage === 'relationship' ? 'About your relationship' : 'Your space is ready'}</AppText>
          <AppText tone="secondary">{stage === 'profile' ? 'This is how you’ll appear throughout Togetherly.' : stage === 'space' ? 'Create a shared space or join the one your partner made.' : stage === 'relationship' ? 'These details shape your dashboard and countdowns.' : 'Everything here will be shaped by the two of you.'}</AppText>
        </View>

        {stage === 'profile' ? <Card style={{ gap: theme.spacing.lg }}>
          <PhotoPickerField label="PROFILE PHOTO · OPTIONAL" value={photo} onChange={setPhoto} circular />
          <FormField label="DISPLAY NAME" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" />
          <FormField label="TIMEZONE" value={timezone} onChangeText={setTimezone} autoCapitalize="none" placeholder="Australia/Brisbane" />
          <AppButton label={busy ? 'Saving…' : 'Continue'} disabled={busy || !name.trim() || !timezone.trim()} onPress={saveProfileStep} />
        </Card> : null}

        {stage === 'space' ? <>
          <View style={{ flexDirection: 'row', padding: 4, backgroundColor: theme.colors.elevatedBackground, borderRadius: theme.radii.pill }}>
            {(['create', 'join'] as const).map((item) => <Pressable accessibilityRole="button" key={item} onPress={() => setMode(item)} style={{ flex: 1, paddingVertical: 11, borderRadius: theme.radii.pill, backgroundColor: mode === item ? theme.colors.card : 'transparent', alignItems: 'center' }}><AppText variant="button" tone={mode === item ? 'accent' : 'muted'}>{item === 'create' ? 'Create space' : 'Join partner'}</AppText></Pressable>)}
          </View>
          {mode === 'create' ? <Card style={{ gap: theme.spacing.lg }}>
            <AppText variant="section">Start your shared home</AppText>
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" tone="secondary">CHOOSE YOUR COLOUR</AppText>
              <AppText variant="bodySmall" tone="secondary">Things you add will carry this colour on both devices. Your partner gets the other colour when they join.</AppText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                {(['purple', 'green'] as const).map((color) => {
                  const palette = participantPalettes[color]; const active = chosenColor === color;
                  return <Pressable key={color} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setChosenColor(color)} style={{ flex: 1 }}><Card participantColor={color} style={{ gap: 8, borderWidth: active ? 2 : 1, borderColor: active ? palette.accent : theme.colors.border }}><View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.accent }} /><AppText variant="cardTitle" style={{ color: palette.accent }}>{palette.label}</AppText><AppText variant="caption" tone="muted">{active ? 'Selected' : 'Choose'}</AppText></Card></Pressable>;
                })}
              </View>
            </View>
            <DatePickerField label="RELATIONSHIP START DATE · OPTIONAL" value={startDate} onChange={setStartDate} optional />
            <ToggleRow label="Long-distance relationship" subtitle="Prioritise visits, timezones and virtual plans on Home." value={longDistance} onChange={setLongDistance} />
            <AppButton label={busy ? 'Creating…' : 'Create our space'} disabled={busy} onPress={createSpace} />
          </Card> : <Card style={{ gap: theme.spacing.lg }}>
            <AppText variant="section">Join your partner</AppText>
            <AppText variant="bodySmall" tone="secondary">Enter the eight-character code they see in Togetherly. Their chosen colour is already reserved; you’ll automatically take the other one.</AppText>
            <FormField label="INVITE CODE" value={inviteCode} onChangeText={(value) => setInviteCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="AB12CD34" autoCapitalize="characters" autoCorrect={false} maxLength={8} />
            <AppButton label={busy ? 'Joining…' : 'Join couple space'} disabled={busy || inviteCode.length !== 8} onPress={joinSpace} />
          </Card>}
        </> : null}

        {stage === 'relationship' ? <Card style={{ gap: theme.spacing.lg }}>
          <DatePickerField label="RELATIONSHIP START DATE · OPTIONAL" value={startDate || couple?.relationship_start_date || ''} onChange={setStartDate} optional />
          <ToggleRow label="Long-distance relationship" subtitle="Prioritise visits, timezones and virtual plans on Home." value={longDistance} onChange={setLongDistance} />
          <AppButton label={busy ? 'Saving…' : 'Continue'} disabled={busy} onPress={saveRelationship} />
        </Card> : null}

        {stage === 'finish' ? <Card participantColor="both" style={{ gap: theme.spacing.lg }}>
          <AppText variant="hero">{profile?.display_name || name}{partnerProfile ? ` + ${partnerProfile.display_name}` : ''}</AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}><AppText variant="caption" style={{ color: participantPalettes[myColor].accent }}>{profile?.display_name?.toUpperCase() || name.toUpperCase()}</AppText><AppText variant="section" style={{ color: participantPalettes[myColor].accent }}>{participantPalettes[myColor].label}</AppText></View>
            <View style={{ flex: 1 }}><AppText variant="caption" style={{ color: participantPalettes[partnerColor].accent }}>{partnerProfile?.display_name?.toUpperCase() || 'INVITED PARTNER'}</AppText><AppText variant="section" style={{ color: participantPalettes[partnerColor].accent }}>{participantPalettes[partnerColor].label}</AppText></View>
          </View>
          <AppButton label={busy ? 'Finishing…' : 'Enter Togetherly'} disabled={busy} onPress={finish} />
        </Card> : null}

        <Pressable accessibilityRole="button" onPress={() => signOut().catch((error: unknown) => Alert.alert('Couldn’t sign out', messageFrom(error)))}><AppText align="center" variant="bodySmall" tone="muted">Sign out</AppText></Pressable>
      </View>
    </AppScreen>
  );
}
