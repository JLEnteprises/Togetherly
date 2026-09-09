import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePreferences } from '@/providers/PreferencesProvider';
import type { AppIconName } from '@/components/art/AppIcon';

export type CelebrationMomentData = {
  title: string;
  body?: string;
  icon?: AppIconName;
  actionLabel?: string;
  onAction?: () => void;
};

export function useCelebrationMoment() {
  const { preferences } = usePreferences();
  const [celebration, setCelebration] = useState<CelebrationMomentData | null>(null);

  const celebrate = useCallback((moment: CelebrationMomentData) => {
    setCelebration(moment);
    if (preferences.haptics && Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [preferences.haptics]);

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  return { celebration, celebrate, dismissCelebration };
}
