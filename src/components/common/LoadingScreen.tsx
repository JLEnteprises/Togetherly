import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useAppTheme } from '@/theme/useAppTheme';

export function LoadingScreen({ label = 'Opening your space…' }: { label?: string }) {
  const theme = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.xxl }}>
        <View style={{ width: 64, height: 64, borderRadius: 24, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={theme.colors.accentStrong} />
        </View>
        <AppText variant="cardTitle">{label}</AppText>
      </View>
    </SafeAreaView>
  );
}
