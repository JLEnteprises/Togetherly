import { router } from 'expo-router';
import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { useAppTheme } from '@/theme/useAppTheme';

const connect = [
  { icon: '⌖', title: 'Live location', subtitle: 'See each other on the map', href: '/features/location' },
  { icon: '?', title: 'Daily question', subtitle: 'Answer separately, reveal together', href: '/features/daily-question' },
  { icon: '☾', title: 'Mood check-in', subtitle: 'Share how you feel', href: '/features/mood' },
] as const;

const dateIdeas = [
  { icon: '✦', title: 'Date ideas', subtitle: 'Save ideas or pick one at random', href: '/features/activities' },
] as const;

export default function TogetherScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <PageHeader eyebrow="Do something" title="Together" />
      <View style={{ gap: theme.spacing.lg }}>
        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, padding: theme.spacing.xl }}>
          <AppText variant="caption" tone="accent">PLAY TOGETHER</AppText>
          <AppText variant="hero">Pick something fun.</AppText>
          <AppText tone="secondary">Games and drawing for two.</AppText>
          <AppButton label="♡ Play together" onPress={() => router.push('/features/play-together' as never)} />
        </Card>
        <FeatureGroupCard eyebrow="CONNECT" title="Connect" items={connect} />
        <FeatureGroupCard eyebrow="DO SOMETHING" title="Date ideas" items={dateIdeas} />
      </View>
    </AppScreen>
  );
}
