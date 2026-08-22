import { router } from 'expo-router';
import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { RecentMemoryCard } from '@/components/dashboard/RecentMemoryCard';
import { useAppTheme } from '@/theme/useAppTheme';

export default function UsScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <PageHeader eyebrow="Our story" title="Us" subtitle="Photos, memories and milestones." />
      <View style={{ gap: theme.spacing.lg }}>
        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, padding: theme.spacing.xl }}>
          <AppText variant="caption" tone="accent">OUR STORY</AppText>
          <AppText variant="hero">Keep the moments that matter.</AppText>
          <AppText tone="secondary">Photos, albums, memories and milestones from your time together.</AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 150 }}><AppButton label="Memories" onPress={() => router.push('/features/memories' as never)} /></View>
            <View style={{ flex: 1, minWidth: 150 }}><AppButton variant="secondary" label="Photos & albums" onPress={() => router.push('/features/photos' as never)} /></View>
          </View>
        </Card>
        <RecentMemoryCard />
      </View>
    </AppScreen>
  );
}
