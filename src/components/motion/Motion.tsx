import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';

export function FadeSlideIn({ children, delay = 0, distance = 10, style }: { children: ReactNode; delay?: number; distance?: number; style?: ViewStyle | ViewStyle[] }) {
  const theme = useAppTheme();
  const progress = useRef(new Animated.Value(theme.reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    if (theme.reducedMotion) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [delay, progress, theme.reducedMotion]);
  const transform = useMemo(() => [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }], [distance, progress]);
  return <Animated.View style={[style, { opacity: progress, transform }]}>{children}</Animated.View>;
}

export function GentleFloat({ children, distance = 4, duration = 2800, style }: { children: ReactNode; distance?: number; duration?: number; style?: ViewStyle | ViewStyle[] }) {
  const theme = useAppTheme();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (theme.reducedMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [duration, theme.reducedMotion, value]);
  const transform = theme.reducedMotion ? undefined : [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }];
  return <Animated.View style={[style, transform ? { transform } : null]}>{children}</Animated.View>;
}

export function RevealScale({ children, trigger, style }: { children: ReactNode; trigger: string | number | boolean; style?: ViewStyle | ViewStyle[] }) {
  const theme = useAppTheme();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (theme.reducedMotion) return;
    value.setValue(0.94);
    Animated.spring(value, { toValue: 1, damping: 12, stiffness: 160, mass: 0.8, useNativeDriver: true }).start();
  }, [theme.reducedMotion, trigger, value]);
  return <Animated.View style={[style, { transform: [{ scale: value }] }]}>{children}</Animated.View>;
}

export function MotionDivider() {
  const theme = useAppTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.68 }} />;
}
