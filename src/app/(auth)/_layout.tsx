import { Stack } from 'expo-router';
import { useAppTheme } from '@/theme/useAppTheme';

export default function AuthLayout() {
  const theme = useAppTheme();
  return <Stack screenOptions={{ headerShown: false, animation: theme.reducedMotion ? 'none' : 'fade' }} />;
}
