import { Tabs } from 'expo-router';
import { Platform, Text, type ColorValue } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';

function TabIcon({ symbol, color, size = 21 }: { symbol: string; color: ColorValue; size?: number }) {
  return <Text style={{ color, fontSize: size, fontWeight: '800' }}>{symbol}</Text>;
}

export default function TabsLayout() {
  const theme = useAppTheme();

  const sharedOptions = {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.accent,
    tabBarInactiveTintColor: theme.colors.textMuted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, marginTop: 1 },
    tabBarStyle: {
      height: Platform.OS === 'ios' ? 88 : 70,
      paddingTop: 8,
      backgroundColor: theme.colors.tabBar,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
    },
    tabBarItemStyle: { paddingVertical: 3 },
  };

  return (
    <Tabs screenOptions={sharedOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon symbol="✦" color={color} /> }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: ({ color }) => <TabIcon symbol="▣" color={color} /> }} />
      <Tabs.Screen name="together" options={{ title: 'Together', tabBarIcon: ({ color }) => <TabIcon symbol="☾" color={color} /> }} />
      <Tabs.Screen name="us" options={{ title: 'Us', tabBarIcon: ({ color }) => <TabIcon symbol="♡" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon symbol="•••" color={color} size={18} /> }} />
    </Tabs>
  );
}
