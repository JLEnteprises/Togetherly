import { View } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';

// F3_ICON_POLISH_ACCESSIBILITY_FINISH: visual progress is also announced numerically by screen readers.
export function ProgressBar({ value, label = 'Progress' }: { value: number; label?: string }) {
  const theme = useAppTheme();
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }} style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: 99, overflow: 'hidden' }}>
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: theme.colors.accentStrong, borderRadius: 99 }} />
    </View>
  );
}
