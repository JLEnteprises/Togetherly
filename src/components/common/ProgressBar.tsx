import { View } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';

export function ProgressBar({ value }: { value: number }) {
  const theme = useAppTheme();
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: 99, overflow: 'hidden' }}>
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: theme.colors.accentStrong, borderRadius: 99 }} />
    </View>
  );
}
