import { useEffect, useRef, useId } from 'react';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';
import { usePreferences } from '@/providers/PreferencesProvider';

const stars = [
  [0.08, 74, 2], [0.18, 138, 3], [0.32, 92, 2], [0.46, 188, 2], [0.63, 115, 3],
  [0.79, 62, 2], [0.91, 166, 2], [0.13, 286, 2], [0.38, 348, 3], [0.72, 302, 2],
] as const;

export function CosmicBackdrop() {
  const theme = useAppTheme();
  const gradientId = useId().replace(/:/g, '');
  const { preferences } = usePreferences();
  const variant = preferences.backdrop_theme;
  const minimal = variant === 'minimal_night';
  const cottage = variant === 'cottagecore';
  const gothic = variant === 'gothic';
  const warm = variant === 'warm_light';
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (preferences.reduced_motion || minimal) { drift.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [drift, minimal, preferences.reduced_motion]);

  const firstOrbitTransform = preferences.reduced_motion ? undefined : [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }];
  const secondOrbitTransform = preferences.reduced_motion ? undefined : [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }, { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!minimal ? <Animated.View style={[styles.glow, { top: -130, right: -105, opacity: gothic ? 0.5 : 0.72 }, firstOrbitTransform ? { transform: firstOrbitTransform } : null]}><AmbientGlow id={`${gradientId}a`} color={theme.participants.me.accent} /></Animated.View> : null}
      {!minimal ? <Animated.View style={[styles.glow, { top: 250, left: -125, opacity: cottage ? 0.72 : 0.58 }, secondOrbitTransform ? { transform: secondOrbitTransform } : null]}><AmbientGlow id={`${gradientId}b`} color={theme.participants.partner.accent} /></Animated.View> : null}
      {warm ? <View style={[styles.warmGlow, { backgroundColor: 'rgba(222,174,112,0.09)' }]} /> : null}
      {!minimal ? <View style={[styles.orbit, { borderColor: theme.participants.me.border, right: -92, top: 78 }]} /> : null}
      {!minimal ? <View style={[styles.orbitSmall, { borderColor: theme.participants.partner.border, left: -72, top: 420 }]} /> : null}
      {cottage ? <View style={[styles.vineArc, { borderColor: theme.colors.vineSoft }]} /> : null}
      {stars.map(([left, top, size], index) => (
        <View key={index} style={{ position: 'absolute', left: `${left * 100}%`, top, width: size, height: size, borderRadius: size, backgroundColor: theme.colors.star, opacity: minimal ? 0.35 : gothic ? 0.85 : 0.62 }} />
      ))}
    </View>
  );
}

function AmbientGlow({ id, color }: { id: string; color: string }) {
  return <Svg width="100%" height="100%" viewBox="0 0 310 310"><Defs><RadialGradient id={id}><Stop offset="0" stopColor={color} stopOpacity="0.14"/><Stop offset="1" stopColor={color} stopOpacity="0"/></RadialGradient></Defs><Rect width="310" height="310" fill={`url(#${id})`} /></Svg>;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: 310, height: 310, borderRadius: 155 },
  warmGlow: { position: 'absolute', width: 390, height: 250, borderRadius: 195, bottom: -150, alignSelf: 'center' },
  orbit: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, opacity: 0.2 },
  orbitSmall: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, opacity: 0.16 },
  vineArc: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 2, borderStyle: 'dashed', left: -190, top: 520, opacity: 0.18 },
});
