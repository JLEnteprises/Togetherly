import { Alert, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { ToggleRow } from '@/components/common/ToggleRow';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

const preferences = [
  { icon: 'home', title: 'Home layout', subtitle: 'Show, hide or reorder the four Home sections', href: '/features/home-layout' },
  { icon: 'spark', title: 'Appearance', subtitle: 'Identity colours and backdrop theme', href: '/features/themes' },
  { icon: 'notification', title: 'Notifications', subtitle: 'Choose what deserves your attention', href: '/features/notifications' },
] as const;

export default function SettingsScreen() {
  const theme = useAppTheme();
  const { preferences: userPreferences, save } = usePreferences();
  async function change(patch: Parameters<typeof save>[0]) {
    try { await save(patch); }
    catch (error) { Alert.alert('Couldn’t save setting', messageFrom(error)); }
  }
  return (
    <AppScreen>
      <BackHeader eyebrow="Account" title="Settings" subtitle="Appearance, notifications and accessibility." />
      <View style={{ gap: theme.spacing.lg }}>
        <FeatureGroupCard eyebrow="PREFERENCES" title="Preferences" items={preferences} accent />
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="secondary">ACCESSIBILITY & FEEDBACK</AppText>
          <ToggleRow label="Reduced motion" subtitle="Keep transitions and motion calmer throughout the app." value={userPreferences.reduced_motion} onChange={(value) => change({ reducedMotion: value })} />
          <ToggleRow label="Haptics" subtitle="Allow subtle tactile feedback on supported phones." value={userPreferences.haptics} onChange={(value) => change({ haptics: value })} />
          <ToggleRow label="High contrast" subtitle="Make text and borders easier to see." value={userPreferences.high_contrast} onChange={(value) => change({ highContrast: value })} />
        </Card>
      </View>
    </AppScreen>
  );
}
