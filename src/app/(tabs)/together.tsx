import { router } from 'expo-router';
import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { ConnectionOrbitArt } from '@/components/art/TogetherlyArt';
import { GentleFloat } from '@/components/motion/Motion';
import { useAppTheme } from '@/theme/useAppTheme';
import { ConnectionPingsCard } from '@/components/together/ConnectionPingsCard';

const connect = [
  { icon: 'question', title: 'Today’s question', subtitle: 'Answer separately, then open it together', href: '/features/daily-question' },
  { icon: 'mood', title: 'How are you feeling?', subtitle: 'Share your mood and what you need', href: '/features/mood' },
  { icon: 'location', title: 'Live location', subtitle: 'See each other on the map when you choose', href: '/features/location' },
] as const;

const dateIdeas = [
  { icon: 'date', title: 'Date ideas', subtitle: 'Save ideas or pick one at random', href: '/features/activities' },
] as const;

export default function TogetherScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <PageHeader eyebrow="Right now" title="Together" subtitle="Talk, play and be a little closer." />
      <View style={{ gap: theme.spacing.lg }}>
        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, padding: theme.spacing.xl, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', marginTop: -6, marginBottom: -8 }}>
            <GentleFloat distance={3}><ConnectionOrbitArt /></GentleFloat>
          </View>
          <View style={{ gap: 5 }}>
            <AppText variant="caption" tone="accent">PLAY TOGETHER</AppText>
            <AppText variant="hero">Do something together.</AppText>
            <AppText tone="secondary">Quick games, shared drawing and tiny ways to feel present with each other.</AppText>
          </View>
          <AppButton label="Play together" onPress={() => router.push('/features/play-together' as never)} />
        </Card>
        <ConnectionPingsCard />
        <FeatureGroupCard eyebrow="CONNECT" title="How are we?" subtitle="Small ways to understand each other today." items={connect} />
        <FeatureGroupCard eyebrow="WHEN YOU WANT SOMETHING TO DO" title="Pick a little moment together" items={dateIdeas} />
      </View>
    </AppScreen>
  );
}
