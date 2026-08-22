import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { TagChip } from '@/components/common/TagChip';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { swapParticipantColors } from '@/services/backend/mvpFeatures';
import { updateProfile } from '@/services/backend/workspace';
import { participantPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { UserPreferences } from '@/types/database';

const themes: { value: UserPreferences['backdrop_theme']; title: string; subtitle: string }[] = [
  { value: 'dual_orbit', title: 'Dual Orbit', subtitle: 'Neutral cosmic night with both identity colours in orbit.' },
  { value: 'minimal_night', title: 'Minimal Night', subtitle: 'Dark, quiet and nearly decoration-free.' },
  { value: 'cottagecore', title: 'Cottage Night', subtitle: 'More green botanical texture without changing who owns each colour.' },
  { value: 'gothic', title: 'Gothic Sky', subtitle: 'Darker atmosphere and stronger star contrast.' },
  { value: 'warm_light', title: 'Warm Night', subtitle: 'Adds a subtle amber glow beneath the purple/green identity system.' },
];

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function ThemesScreen() {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor, refresh } = useWorkspace();
  const { preferences, save } = usePreferences();

  async function choose(backdropTheme: UserPreferences['backdrop_theme']) {
    try { await save({ backdropTheme }); }
    catch (error) { Alert.alert('Couldn’t save theme', messageFrom(error)); }
  }
  async function swap() {
    try { await swapParticipantColors(); await refresh(); }
    catch (error) { Alert.alert('Couldn’t swap colours', messageFrom(error)); }
  }
  async function chooseSoloColor(color: 'purple' | 'green') {
    try { await updateProfile({ preferredColor: color }); await refresh(); }
    catch (error) { Alert.alert('Couldn’t change colour', messageFrom(error)); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="More" title="Colours & theme" subtitle="Choose your colours and backdrop." />
      <Card participantColor="both" style={{ gap: theme.spacing.lg, overflow: 'hidden', marginBottom: theme.spacing.xxl }}>
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: participantPalettes.purple.glow, right: -60, top: -65 }} />
        <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: participantPalettes.green.glow, left: -50, bottom: -60 }} />
        <AppText variant="caption" tone="secondary">IDENTITY COLOURS</AppText>
        <AppText variant="hero">Purple + Green</AppText>
        <AppText tone="secondary">Your colour marks the things you add.</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TagChip participantColor={myColor} label={`${participantPalettes[myColor].label.toUpperCase()} · ${profile?.display_name?.toUpperCase() ?? 'ME'}`} />
          <TagChip participantColor={partnerColor} label={`${participantPalettes[partnerColor].label.toUpperCase()} · ${partnerProfile?.display_name?.toUpperCase() ?? 'WAITING'}`} />
        </View>
        {partnerProfile ? <AppButton label="Swap our colours" variant="secondary" onPress={swap} /> : <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton label="Use Purple" variant={myColor === 'purple' ? 'primary' : 'secondary'} onPress={() => chooseSoloColor('purple')} /></View><View style={{ flex: 1 }}><AppButton label="Use Green" variant={myColor === 'green' ? 'primary' : 'secondary'} onPress={() => chooseSoloColor('green')} /></View></View>}
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="section">Backdrop</AppText>
        {themes.map((option) => {
          const active = preferences.backdrop_theme === option.value;
          return (
            <Pressable accessibilityRole="button" key={option.value} onPress={() => choose(option.value)}>
              {({ pressed }) => <Card tone={active ? 'accent' : 'default'} style={{ gap: 5, opacity: pressed ? 0.72 : 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><AppText variant="cardTitle">{option.title}</AppText><AppText variant="bodySmall" tone="secondary">{option.subtitle}</AppText></View>{active ? <TagChip label="ACTIVE" /> : null}</View></Card>}
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}
