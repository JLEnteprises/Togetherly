import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { TagChip } from '@/components/common/TagChip';
import { Avatar } from '@/components/common/Avatar';
import { ParticipantColorPicker } from '@/components/common/ParticipantColorPicker';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { participantColorsTooClose, participantPalettes, participantPalette } from '@/theme/tokens';
import { updateProfile } from '@/services/backend/workspace';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ParticipantColor, UserPreferences } from '@/types/database';

const themes: { value: UserPreferences['backdrop_theme']; title: string; subtitle: string }[] = [
  { value: 'dual_orbit', title: 'Dual Orbit', subtitle: 'Cosmic night with both of your colours in orbit.' },
  { value: 'minimal_night', title: 'Minimal Night', subtitle: 'Dark, quiet and nearly decoration-free.' },
  { value: 'cottagecore', title: 'Cottage Night', subtitle: 'Botanical details over a softer night sky.' },
  { value: 'gothic', title: 'Gothic Sky', subtitle: 'Darker atmosphere and stronger star contrast.' },
  { value: 'warm_light', title: 'Warm Night', subtitle: 'A soft amber glow over the night backdrop.' },
];

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function initial(value: string | undefined) { return value?.trim().slice(0, 1).toUpperCase() || '♡'; }

export default function ThemesScreen() {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor, refresh } = useWorkspace();
  const { preferences, save } = usePreferences();
  const [draftColor, setDraftColor] = useState<ParticipantColor>(myColor);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraftColor(myColor); }, [myColor]);

  async function choose(backdropTheme: UserPreferences['backdrop_theme']) {
    try { await save({ backdropTheme }); }
    catch (error) { Alert.alert('Couldn’t save theme', messageFrom(error)); }
  }

  async function saveIdentityColor() {
    if (partnerProfile && participantColorsTooClose(draftColor, partnerColor)) {
      Alert.alert('Choose a more distinct colour', 'Your two identity colours need to be easy to tell apart at a glance.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ preferredColor: draftColor });
      await refresh();
    } catch (error) { Alert.alert('Couldn’t change your colour', messageFrom(error)); }
    finally { setBusy(false); }
  }

  const myPalette = participantPalette(myColor);
  const partnerPalette = participantPalette(partnerColor);

  return (
    <AppScreen>
      <BackHeader eyebrow="Settings" title="Identity & appearance" subtitle="Your colours identify people. Togetherly itself stays neutral." />

      <Card participantColor="both" style={{ gap: theme.spacing.lg, overflow: 'hidden', marginBottom: theme.spacing.xxl }}>
        <AppText variant="caption" tone="secondary">YOUR SHARED SIGNATURE</AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
            <Avatar initials={initial(profile?.display_name)} imageUrl={profile?.avatar_url} size={54} participantColor={myColor} />
            <AppText variant="cardTitle" style={{ color: myPalette.accent }}>{profile?.display_name ?? 'You'}</AppText>
            <TagChip participantColor={myColor} label="YOU" />
          </View>
          <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>
            <Avatar initials={initial(partnerProfile?.display_name)} imageUrl={partnerProfile?.avatar_url} size={54} participantColor={partnerColor} />
            <AppText variant="cardTitle" style={{ color: partnerPalette.accent }}>{partnerProfile?.display_name ?? 'Partner'}</AppText>
            <TagChip participantColor={partnerColor} label={partnerProfile ? 'PARTNER' : 'WAITING'} />
          </View>
        </View>
        <AppText variant="bodySmall" tone="secondary" align="center">
          Your colour marks your avatar, ownership, assignment, drawing strokes and player identity. Both colours together mean “us”.
        </AppText>
      </Card>

      <Card style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
        <AppText variant="section">My identity colour</AppText>
        <ParticipantColorPicker value={draftColor} onChange={setDraftColor} partnerColor={partnerProfile ? partnerColor : undefined} />
        <AppButton label={busy ? 'Saving…' : 'Save my colour'} disabled={busy || draftColor === myColor} onPress={saveIdentityColor} />
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="section">Backdrop</AppText>
        {themes.map((option) => {
          const active = preferences.backdrop_theme === option.value;
          return (
            <Pressable accessibilityRole="button" key={option.value} onPress={() => choose(option.value)}>
              {({ pressed }) => (
                <Card tone={active ? 'accent' : 'default'} style={{ gap: 5, opacity: pressed ? 0.72 : 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="cardTitle">{option.title}</AppText>
                      <AppText variant="bodySmall" tone="secondary">{option.subtitle}</AppText>
                    </View>
                    {active ? <TagChip label="ACTIVE" /> : null}
                  </View>
                </Card>
              )}
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}
