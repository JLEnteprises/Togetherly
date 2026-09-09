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
import { HomeConnectionActions } from '@/components/dashboard/HomeConnectionActions';
import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';
import { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';

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
      <PageHeader eyebrow="Right now" title="Together" subtitle="The part of your space for actually being together." />
      <View style={{ gap: theme.spacing.lg }}>
        {/* E3_PAIRED_COUPLE_IDENTITY */}
        <CoupleIdentitySignature detail="A space for the two of you to be present together." />
        <PartnerPresencePill scope="together" />

        <HomeConnectionActions />

        <FeatureGroupCard
          eyebrow="A LITTLE DEEPER"
          title="Check in together"
          subtitle="The question, moods and little context that help you understand each other."
          items={connect}
        />

        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, padding: theme.spacing.xl, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', marginTop: -6, marginBottom: -8 }}>
            <GentleFloat distance={3}><ConnectionOrbitArt /></GentleFloat>
          </View>
          <View style={{ gap: 5 }}>
            <AppText variant="caption" tone="accent">DO SOMETHING TOGETHER</AppText>
            <AppText variant="hero">Play for a bit.</AppText>
            <AppText tone="secondary">Games, shared drawing and little spaces that feel better when you’re both there.</AppText>
          </View>
          <AppButton label="Play together" onPress={() => router.push('/features/play-together' as never)} />
        </Card>

        <FeatureGroupCard eyebrow="WHEN YOU WANT SOMETHING TO DO" title="Pick a little moment together" items={dateIdeas} />
      </View>
    </AppScreen>
  );
}
