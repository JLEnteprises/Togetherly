import { StyleSheet, View } from 'react-native';
import { participantPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { usePreferences } from '@/providers/PreferencesProvider';

const stars = [
  [0.08, 74, 2], [0.18, 138, 3], [0.32, 92, 2], [0.46, 188, 2], [0.63, 115, 3],
  [0.79, 62, 2], [0.91, 166, 2], [0.13, 286, 2], [0.38, 348, 3], [0.72, 302, 2],
] as const;

export function CosmicBackdrop() {
  const theme = useAppTheme();
  const { preferences } = usePreferences();
  const variant = preferences.backdrop_theme;
  const minimal = variant === 'minimal_night';
  const cottage = variant === 'cottagecore';
  const gothic = variant === 'gothic';
  const warm = variant === 'warm_light';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!minimal ? <View style={[styles.glow, { backgroundColor: participantPalettes.purple.glow, top: -130, right: -105, opacity: gothic ? 0.6 : 1 }]} /> : null}
      {!minimal ? <View style={[styles.glow, { backgroundColor: participantPalettes.green.glow, top: 250, left: -125, opacity: cottage ? 1 : 0.8 }]} /> : null}
      {warm ? <View style={[styles.warmGlow, { backgroundColor: 'rgba(222,174,112,0.09)' }]} /> : null}
      {!minimal ? <View style={[styles.orbit, { borderColor: participantPalettes.purple.border, right: -92, top: 78 }]} /> : null}
      {!minimal ? <View style={[styles.orbitSmall, { borderColor: participantPalettes.green.border, left: -72, top: 420 }]} /> : null}
      {cottage ? <View style={[styles.vineArc, { borderColor: participantPalettes.green.border }]} /> : null}
      {stars.map(([left, top, size], index) => (
        <View key={index} style={{ position: 'absolute', left: `${left * 100}%`, top, width: size, height: size, borderRadius: size, backgroundColor: theme.colors.star, opacity: minimal ? 0.35 : gothic ? 0.85 : 0.62 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', width: 310, height: 310, borderRadius: 155 },
  warmGlow: { position: 'absolute', width: 390, height: 250, borderRadius: 195, bottom: -150, alignSelf: 'center' },
  orbit: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, opacity: 0.2 },
  orbitSmall: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, opacity: 0.16 },
  vineArc: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 2, borderStyle: 'dashed', left: -190, top: 520, opacity: 0.18 },
});
