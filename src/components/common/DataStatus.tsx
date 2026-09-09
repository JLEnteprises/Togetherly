import { View } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
export function DataStatus({ loading, error, retry }: { loading?: boolean; error?: boolean; retry?: () => void }) {
  if (!loading && !error) return null;
  return <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
    <AppText variant="bodySmall" tone={error ? 'warning' : 'muted'}>{loading ? 'Loading your shared space…' : 'Some information couldn’t be updated. What’s shown may be out of date.'}</AppText>
    {error && !loading && retry ? <AppButton compact variant="secondary" label="Try again" onPress={retry} /> : null}
  </View>;
}
