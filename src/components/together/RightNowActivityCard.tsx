import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppIcon } from '@/components/art/AppIcon';
import { useAppTheme } from '@/theme/useAppTheme';

export function RightNowActivityCard() {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="What fits right now? Let Togetherly use your current context to pick something to do together."
      onPress={() => router.push('/features/activity-now' as never)}
    >
      {({ pressed }) => (
        <Card participantColor="both" tone="accent" style={{ padding: theme.spacing.lg, opacity: pressed ? 0.78 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft }}>
              <AppIcon name="spark" size={21} color={theme.colors.accentStrong} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="caption" tone="accent">LET TOGETHERLY CONNECT THE DOTS</AppText>
              <AppText variant="cardTitle">What fits right now?</AppText>
              <AppText variant="bodySmall" tone="secondary">Use your time, shared availability, distance setup and recent check-ins to pick for you.</AppText>
            </View>
            <AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}
