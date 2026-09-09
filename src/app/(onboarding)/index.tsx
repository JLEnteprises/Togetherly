import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { FormField } from '@/components/common/FormField';
import { TimezonePickerField } from '@/components/common/TimezonePickerField';
import { useLocationSharing } from '@/providers/LocationProvider';
import { DatePickerField } from '@/components/common/DatePickerField';
import { PhotoPickerField } from '@/components/common/PhotoPickerField';
import { ParticipantColorPicker } from '@/components/common/ParticipantColorPicker';
import { ToggleRow } from '@/components/common/ToggleRow';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { createCoupleWorkspace, joinCoupleWithCode, updateCouple, updateProfile } from '@/services/backend/workspace';
import { refreshCurrentUser } from '@/services/backend/auth';
import { useAuth } from '@/providers/AuthProvider';
import { LEGACY_PURPLE_COLOR, normalizeParticipantColor, participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ParticipantColor } from '@/types/database';
import { ConnectionOrbitArt, TogetherlyMark } from '@/components/art/TogetherlyArt';
import { FadeSlideIn, GentleFloat } from '@/components/motion/Motion';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
type Stage = 'profile' | 'space' | 'relationship' | 'finish';

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const { profile, partnerProfile, couple, myColor, partnerColor, refresh } = useWorkspace();
  const { signOut } = useAuth();
  const { refreshAutomaticTimezone } = useLocationSharing();
  const [stage, setStage] = useState<Stage>('profile');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [timezoneMode, setTimezoneMode] = useState<'automatic' | 'manual'>('automatic');
  const [photo, setPhoto] = useState<string | null>(null);
  const [chosenColor, setChosenColor] = useState<ParticipantColor>(LEGACY_PURPLE_COLOR);
  const [inviteCode, setInviteCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [longDistance, setLongDistance] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.onboarding_complete ? profile.display_name : profile.display_name === 'New member' ? '' : profile.display_name);
    setTimezone(profile.timezone || detectedTimezone);
    setTimezoneMode(profile.timezone_mode ?? 'automatic');
    setPhoto(profile.avatar_url);
    setChosenColor(normalizeParticipantColor(profile.preferred_participant_color ?? myColor, LEGACY_PURPLE_COLOR));
    if (couple) {
      setStartDate(couple.relationship_start_date ?? '');
      setLongDistance(Boolean(couple.long_distance_enabled));
    }
    if (profile.onboarding_complete && !couple) setStage('space');
  }, [couple?.id, couple?.relationship_start_date, couple?.long_distance_enabled, detectedTimezone, myColor, profile?.id, profile?.timezone_mode]);

  async function saveProfileStep() {
    if (!name.trim()) { Alert.alert('What should we call you?', 'Add the name you want your partner to see.'); return; }
    setBusy(true);
    try {
      let chosenTimezone=timezone.trim(); if(timezoneMode==='automatic') chosenTimezone=(await refreshAutomaticTimezone()) ?? detectedTimezone;
      await updateProfile({ displayName: name.trim(), timezone: chosenTimezone, timezoneMode, avatarUrl: photo, onboardingComplete: false });
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
      await joinCoupleWithCode(inviteCode, chosenColor);
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
          <AppText tone="secondary">{stage === 'profile' ? 'Add your name, photo and timezone.' : stage === 'space' ? 'Create a space or join your partner.' : stage === 'relationship' ? 'Add the details that matter to you.' : 'You’re ready to go.'}</AppText>
        </View>

        {stage === 'profile' ? <Card style={{ gap: theme.spacing.lg }}>
          <PhotoPickerField label="PROFILE PHOTO · OPTIONAL" value={photo} onChange={setPhoto} circular />
          <FormField label="DISPLAY NAME" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" />
          <ToggleRow label="Automatic timezone" subtitle="Use your location to set local time." value={timezoneMode === 'automatic'} onChange={(value) => setTimezoneMode(value ? 'automatic' : 'manual')} />
          {timezoneMode === 'manual' ? <TimezonePickerField value={timezone} onChange={setTimezone} /> : <AppText variant="bodySmall" tone="muted">Set automatically from your location.</AppText>}
          <AppButton label={busy ? 'Saving…' : 'Continue'} disabled={busy || !name.trim() || !timezone.trim()} onPress={saveProfileStep} />
        </Card> : null}

        {stage === 'space' ? <>
          <View style={{ alignItems: 'center', marginTop: -8, marginBottom: -14 }}><ConnectionOrbitArt width={220} height={98} /></View>
          <View style={{ flexDirection: 'row', padding: 4, backgroundColor: theme.colors.elevatedBackground, borderRadius: theme.radii.pill }}>
            {(['create', 'join'] as const).map((item) => <Pressable accessibilityRole="button" key={item} onPress={() => setMode(item)} style={{ flex: 1, paddingVertical: 11, borderRadius: theme.radii.pill, backgroundColor: mode === item ? theme.colors.card : 'transparent', alignItems: 'center' }}><AppText variant="button" tone={mode === item ? 'accent' : 'muted'}>{item === 'create' ? 'Create space' : 'Join partner'}</AppText></Pressable>)}
          </View>
          {mode === 'create' ? <Card style={{ gap: theme.spacing.lg }}>
            <AppText variant="section">Start your shared home</AppText>
            <ParticipantColorPicker value={chosenColor} onChange={setChosenColor} label="CHOOSE YOUR COLOUR" />
            <DatePickerField label="RELATIONSHIP START DATE · OPTIONAL" value={startDate} onChange={setStartDate} optional />
            <ToggleRow label="Long-distance relationship" subtitle="Show visits, time difference and shared free time on Home." value={longDistance} onChange={setLongDistance} />
            <AppButton label={busy ? 'Creating…' : 'Create our space'} disabled={busy} onPress={createSpace} />
          </Card> : <Card style={{ gap: theme.spacing.lg }}>
            <AppText variant="section">Join your partner</AppText>
            <AppText variant="bodySmall" tone="secondary">Enter your partner’s 8-character code, then choose the colour that will identify you.</AppText>
            <ParticipantColorPicker value={chosenColor} onChange={setChosenColor} label="YOUR COLOUR BEFORE JOINING" />
            <FormField label="INVITE CODE" value={inviteCode} onChangeText={(value) => setInviteCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="AB12CD34" autoCapitalize="characters" autoCorrect={false} maxLength={8} />
            <AppButton label={busy ? 'Joining…' : 'Join couple space'} disabled={busy || inviteCode.length !== 8} onPress={joinSpace} />
          </Card>}
        </> : null}

        {stage === 'relationship' ? <Card style={{ gap: theme.spacing.lg }}>
          <DatePickerField label="RELATIONSHIP START DATE · OPTIONAL" value={startDate || couple?.relationship_start_date || ''} onChange={setStartDate} optional />
          <ToggleRow label="Long-distance relationship" subtitle="Show visits, time difference and shared free time on Home." value={longDistance} onChange={setLongDistance} />
          <AppButton label={busy ? 'Saving…' : 'Continue'} disabled={busy} onPress={saveRelationship} />
        </Card> : null}

        {stage === 'finish' ? <FadeSlideIn><Card participantColor="both" tone="accent" style={{ gap: theme.spacing.lg, alignItems: 'center', paddingVertical: theme.spacing.xxl, overflow: 'hidden' }}>
          <GentleFloat distance={3}><TogetherlyMark size={84} /></GentleFloat>
          <View style={{ gap: 5, alignItems: 'center' }}><AppText variant="caption" tone="accent">YOUR SPACE IS READY</AppText><AppText variant="hero" align="center">{profile?.display_name || name}{partnerProfile ? ` + ${partnerProfile.display_name}` : ''}</AppText><AppText tone="secondary" align="center">Two accounts. One shared space. Everything else can grow from here.</AppText></View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, width: '100%' }}>
            <View style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: participantPalette(myColor).accent, marginBottom: 5 }} /><AppText variant="caption" style={{ color: participantPalette(myColor).accent }}>{profile?.display_name?.toUpperCase() || name.toUpperCase()}</AppText></View>
            <View style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: participantPalette(partnerColor).accent, marginBottom: 5 }} /><AppText variant="caption" style={{ color: participantPalette(partnerColor).accent }}>{partnerProfile?.display_name?.toUpperCase() || 'INVITED PARTNER'}</AppText></View>
          </View>
          <View style={{ width: '100%' }}><AppButton icon="heart" label={busy ? 'Finishing…' : 'Enter Togetherly'} disabled={busy} onPress={finish} /></View>
        </Card></FadeSlideIn> : null}

        <Pressable accessibilityRole="button" onPress={() => signOut().catch((error: unknown) => Alert.alert('Couldn’t sign out', messageFrom(error)))}><AppText align="center" variant="bodySmall" tone="muted">Sign out</AppText></Pressable>
      </View>
    </AppScreen>
  );
}
