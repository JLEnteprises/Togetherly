import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePreferences } from '@/providers/PreferencesProvider';

export function useInteractionFeedback() {
  const { preferences } = usePreferences();

  return useCallback(() => {
    if (!preferences.haptics || Platform.OS === 'web') return;
    void Haptics.selectionAsync().catch(() => undefined);
  }, [preferences.haptics]);
}
