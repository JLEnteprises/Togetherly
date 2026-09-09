import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { AppIcon } from '@/components/art/AppIcon';
import type { CelebrationMomentData } from '@/hooks/useCelebrationMoment';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

export function CelebrationMoment({
  moment,
  onDismiss,
}: {
  moment: CelebrationMomentData | null;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!moment) return;
    progress.stopAnimation();
    progress.setValue(theme.reducedMotion ? 1 : 0);

    const animation = theme.reducedMotion
      ? null
      : Animated.timing(progress, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.back(1.35)),
          useNativeDriver: true,
        });
    animation?.start();

    const timeout = setTimeout(onDismiss, moment.actionLabel ? 3600 : 1900);
    return () => {
      animation?.stop();
      clearTimeout(timeout);
    };
  }, [moment, onDismiss, progress, theme.reducedMotion]);

  if (!moment) return null;

  const cardScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const cardOpacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 1],
  });
  const sparkleLift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -10],
  });
  const sparkleOpacity = progress.interpolate({
    inputRange: [0, 0.18, 0.82, 1],
    outputRange: [0, 1, 1, 0.35],
  });

  function runAction() {
    if (!moment) return;
    const action = moment.onAction;
    onDismiss();
    action?.();
  }

  return (
    <Modal visible transparent animationType={theme.reducedMotion ? 'none' : 'fade'} statusBarTranslucent onRequestClose={onDismiss}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.overlay, padding: theme.spacing.xl }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss celebration" onPress={onDismiss} style={{ position: 'absolute', inset: 0 }} />

        <Animated.View
          style={{
            width: '100%',
            maxWidth: 430,
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          }}
        >
          <View style={{ position: 'absolute', left: 26, top: -22 }}>
            <Animated.View style={{ opacity: sparkleOpacity, transform: [{ translateY: sparkleLift }, { rotate: '-14deg' }] }}>
              <AppIcon name="spark" size={28} color={theme.colors.accent} />
            </Animated.View>
          </View>
          <View style={{ position: 'absolute', right: 24, top: -12 }}>
            <Animated.View style={{ opacity: sparkleOpacity, transform: [{ translateY: sparkleLift }, { rotate: '16deg' }] }}>
              <AppIcon name="heart" size={25} color={theme.colors.accentStrong} />
            </Animated.View>
          </View>
          <View style={{ position: 'absolute', left: 54, bottom: -15 }}>
            <Animated.View style={{ opacity: sparkleOpacity, transform: [{ translateY: sparkleLift }] }}>
              <AppIcon name="spark" size={20} color={theme.colors.success} />
            </Animated.View>
          </View>

          <View
            style={{
              borderRadius: theme.radii.xl,
              borderWidth: 1,
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.background,
              padding: theme.spacing.xl,
              gap: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accentSoft,
              }}
            >
              <AppIcon name={moment.icon ?? 'spark'} size={34} color={theme.colors.accentStrong} />
            </View>

            <View style={{ gap: 6, alignItems: 'center' }}>
              <AppText variant="pageTitle" align="center">{moment.title}</AppText>
              {moment.body ? <AppText tone="secondary" align="center">{moment.body}</AppText> : null}
            </View>

            {moment.actionLabel ? (
              <View style={{ width: '100%' }}>
                <AppButton label={moment.actionLabel} onPress={runAction} />
              </View>
            ) : (
              <AppText variant="caption" tone="muted">A little win for the two of you.</AppText>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
