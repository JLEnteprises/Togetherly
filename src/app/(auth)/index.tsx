import { router } from 'expo-router';
import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { TogetherlyMark, ConnectionOrbitArt } from '@/components/art/TogetherlyArt';
import { FadeSlideIn, GentleFloat } from '@/components/motion/Motion';
import { useAppTheme } from '@/theme/useAppTheme';

export default function WelcomeScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen contentStyle={{ justifyContent: 'center', paddingBottom: theme.spacing.huge }}>
      <View style={{ gap: theme.spacing.xxxl }}>
        <View style={{ gap: theme.spacing.lg }}>
          <GentleFloat distance={3}><TogetherlyMark /></GentleFloat>
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" tone="accent">TOGETHERLY</AppText>
            <AppText variant="hero">Your life, together.</AppText>
            <AppText tone="secondary">The little things you plan, feel, remember and do together — all in one private space.</AppText>
          </View>
        </View>

        <FadeSlideIn delay={90}>
          <Card participantColor="both" tone="secondary" style={{ gap: theme.spacing.md, padding: theme.spacing.lg, overflow: 'hidden' }}>
            <View style={{ alignItems: 'center', marginTop: -12, marginBottom: -16 }}><ConnectionOrbitArt width={230} height={102} /></View>
            <View style={{ gap: 4 }}>
              <AppText variant="caption" tone="accent">BUILT FOR TWO</AppText>
              <AppText variant="cardTitle">Know what matters today.</AppText>
              <AppText variant="bodySmall" tone="secondary">Check in, count down to visits, answer together, make plans and keep the memories that become your story.</AppText>
            </View>
          </Card>
        </FadeSlideIn>

        <View style={{ gap: theme.spacing.md }}>
          <AppButton label="Create my account" onPress={() => router.push('/register')} />
          <AppButton label="I already have an account" variant="ghost" onPress={() => router.push('/login')} />
          <AppText variant="caption" tone="muted" align="center">Private by design · each person keeps their own account</AppText>
        </View>
      </View>
    </AppScreen>
  );
}
