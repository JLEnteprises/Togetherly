import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
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
import { AppIcon } from '@/components/art/AppIcon';

const manage = [
  { icon: 'heart', title: 'Your relationship', subtitle: 'The details that shape your shared space', href: '/features/couple-profile' },
  { icon: 'settings', title: 'Settings', subtitle: 'Appearance, notifications and accessibility', href: '/features/settings' },
  { icon: 'privacy', title: 'Privacy', subtitle: 'Shared and private content', href: '/features/privacy' },
  { icon: 'tag', title: 'Tags', subtitle: 'The labels you use to keep things findable', href: '/features/tags' },
] as const;

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function initial(name: string | undefined) { return name?.trim()?.slice(0, 1).toUpperCase() || '♡'; }

export default function MoreScreen() {
  const theme = useAppTheme();
  const { signOut } = useAuth();
  const { profile, myColor } = useWorkspace();
  async function logOut() { try { await signOut(); } catch (error) { Alert.alert('Couldn’t sign out', messageFrom(error)); } }

  return (
    <AppScreen>
      <PageHeader eyebrow="Your space" title="Account" subtitle="Your profile, preferences, and shared space." />
      <View style={{ gap: theme.spacing.lg }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open account and profile" onPress={() => router.push('/features/account' as never)}>
          {({ pressed }) => <Card participantColor={myColor} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, opacity: pressed ? 0.75 : 1 }}>
            <Avatar initials={initial(profile?.display_name)} imageUrl={profile?.avatar_url} size={52} participantColor={myColor} />
            <View style={{ flex: 1, gap: 2 }}><AppText variant="section">{profile?.display_name ?? 'Your profile'}</AppText><AppText variant="caption" tone="muted">Account & profile</AppText></View>
            <AppIcon name="chevron" size={17} color={theme.colors.textMuted} />
          </Card>}
        </Pressable>

        <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => router.push('/features/search' as never)}>
          {({ pressed }) => <Card tone="secondary" style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, opacity: pressed ? 0.72 : 1 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name="search" size={19} color={theme.colors.textSecondary} /></View>
            <AppText variant="cardTitle" style={{ flex: 1 }}>Search</AppText>
            <AppIcon name="chevron" size={17} color={theme.colors.textMuted} />
          </Card>}
        </Pressable>

        <FeatureGroupCard eyebrow="YOUR SPACE" title="Behind the scenes" subtitle="Things you probably won’t need every day." items={manage} />
        <AppButton label="Sign out" variant="ghost" onPress={logOut} />
      </View>
    </AppScreen>
  );
}
