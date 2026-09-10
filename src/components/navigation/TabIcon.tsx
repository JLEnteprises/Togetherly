import { View, type ColorValue } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';

export type TabIconName = Extract<AppIconName, 'home' | 'plan' | 'together' | 'us' | 'more'>;
export function TabIcon({ name, color, size = 22, focused = false }: { name: TabIconName; color: ColorValue; size?: number; focused?: boolean }) {
  const theme = useAppTheme();
  return <View style={{ width: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? theme.colors.accentSoft : 'transparent' }}><AppIcon name={name} color={color as string} size={size} strokeWidth={focused ? 2.2 : 1.7} /></View>;
}

