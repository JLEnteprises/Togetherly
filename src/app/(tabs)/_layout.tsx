import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';
import { TabIcon } from '@/components/navigation/TabIcon';


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
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: ({ color }) => <TabIcon name="plan" color={color} /> }} />
      <Tabs.Screen name="together" options={{ title: 'Together', tabBarIcon: ({ color }) => <TabIcon name="together" color={color} /> }} />
      <Tabs.Screen name="us" options={{ title: 'Us', tabBarIcon: ({ color }) => <TabIcon name="us" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name="more" color={color} size={20} /> }} />
    </Tabs>
  );
}
