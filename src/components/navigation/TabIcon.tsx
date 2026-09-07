import type { ColorValue } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';

export type TabIconName = Extract<AppIconName, 'home' | 'plan' | 'together' | 'us' | 'more'>;
export function TabIcon({ name, color, size = 22 }: { name: TabIconName; color: ColorValue; size?: number }) {
  return <AppIcon name={name} color={color as string} size={size} strokeWidth={1.9} />;
}

