import { Alert, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Avatar } from '@/components/common/Avatar';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { useAuth } from '@/providers/AuthProvider';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';

const find = [
  { icon: '⌕', title: 'Search', subtitle: 'Find anything in your shared space', href: '/features/search' },
] as const;
const people = [
  { icon: '♡', title: 'Couple profile', subtitle: 'Relationship details and linked accounts', href: '/features/couple-profile' },
  { icon: '☺', title: 'Account & profile', subtitle: 'Photo, name, email, password and sessions', href: '/features/account' },
] as const;
const app = [
  { icon: '⚙', title: 'Settings', subtitle: 'Appearance, notifications and accessibility', href: '/features/settings' },
  { icon: '♢', title: 'Privacy', subtitle: 'Shared and private content', href: '/features/privacy' },
] as const;

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function initial(name: string | undefined) { return name?.trim()?.slice(0,1).toUpperCase() || '♡'; }

export default function MoreScreen() {
  const theme = useAppTheme();
  const { signOut } = useAuth();
  const { profile, partnerProfile, couple, myColor, partnerColor } = useWorkspace();
  async function logOut() { try { await signOut(); } catch (error) { Alert.alert('Couldn’t sign out', messageFrom(error)); } }

  return (
    <AppScreen>
      <PageHeader eyebrow="Make it yours" title="More" subtitle="Account, settings and privacy." />
      <View style={{ gap: theme.spacing.lg }}>
        <Card participantColor="both" style={{ gap: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Avatar initials={initial(profile?.display_name)} imageUrl={profile?.avatar_url} size={52} participantColor={myColor} />
            <View style={{ flex: 1 }}><AppText variant="section">{profile?.display_name}</AppText><AppText variant="caption" tone="muted">{profile?.timezone}</AppText></View>
          </View>
          {partnerProfile ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}><Avatar initials={initial(partnerProfile.display_name)} imageUrl={partnerProfile.avatar_url} size={52} participantColor={partnerColor} /><View style={{ flex: 1 }}><AppText variant="section">{partnerProfile.display_name}</AppText><AppText variant="caption" tone="muted">{partnerProfile.timezone}</AppText></View></View> : <AppText tone="secondary">Your invite is ready whenever your partner is.</AppText>}
          <AppText variant="bodySmall" tone="secondary">{partnerProfile ? (couple?.long_distance_enabled ? 'Long-distance relationship' : 'Sharing life together') : 'One account linked so far'}</AppText>
        </Card>
        <FeatureGroupCard title="Find" items={find} />
        <FeatureGroupCard title="People & relationship" items={people} />
        <FeatureGroupCard title="App preferences" items={app} />
        <AppButton label="Sign out" variant="ghost" onPress={logOut} />
      </View>
    </AppScreen>
  );
}
