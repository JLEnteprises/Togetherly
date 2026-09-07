import { Stack } from 'expo-router';
import { useAppTheme } from '@/theme/useAppTheme';

export default function FeaturesLayout() {
  const theme = useAppTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: theme.reducedMotion ? 'none' : 'slide_from_right' }} />;
}
