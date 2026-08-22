import { router } from 'expo-router';
import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { useAppTheme } from '@/theme/useAppTheme';

export default function WelcomeScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen contentStyle={{ justifyContent: 'center', paddingBottom: theme.spacing.huge }}>
      <View style={{ gap: theme.spacing.xxxl }}>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ width: 70, height: 70, borderRadius: 26, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="pageTitle" tone="accent">♥</AppText>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" tone="accent">YOUR SHARED LIFE, IN ONE PLACE</AppText>
            <AppText variant="hero">Together works better together.</AppText>
            <AppText tone="secondary">Plans, lists, memories, countdowns and the little things that make distance feel smaller.</AppText>
          </View>
        </View>

        <Card tone="secondary" style={{ gap: theme.spacing.md }}>
          <AppText variant="cardTitle">Private by design</AppText>
          <AppText variant="bodySmall" tone="secondary">You each keep your own account, while the things you choose to share live in one private space together.</AppText>
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          <AppButton label="Create my account" onPress={() => router.push('/register')} />
          <AppButton label="I already have an account" variant="ghost" onPress={() => router.push('/login')} />
        </View>
      </View>
    </AppScreen>
  );
}
