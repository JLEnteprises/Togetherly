import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';
import { TabIcon } from '@/components/navigation/TabIcon';


// F3_ICON_POLISH_ACCESSIBILITY_FINISH: primary navigation has explicit, stable screen-reader labels.
export default function TabsLayout() {
  const theme = useAppTheme();

  const sharedOptions = {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.accent,
    tabBarInactiveTintColor: theme.colors.textMuted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, marginTop: 1 },
    tabBarStyle: {
      height: Platform.OS === 'ios' ? 88 : 70,
      paddingTop: 10,
      backgroundColor: theme.colors.tabBar,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
    },
    tabBarItemStyle: { paddingVertical: 3 },
  };

  return (
    <Tabs screenOptions={sharedOptions}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home tab', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="home" color={color} /> }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarAccessibilityLabel: 'Plan tab', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="plan" color={color} /> }} />
      <Tabs.Screen name="together" options={{ title: 'Connect', tabBarAccessibilityLabel: 'Connect tab', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="together" color={color} /> }} />
      <Tabs.Screen name="us" options={{ title: 'Our story', tabBarAccessibilityLabel: 'Our story tab', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="us" color={color} /> }} />
      <Tabs.Screen name="more" options={{ href: null, title: 'Account', tabBarAccessibilityLabel: 'Account', tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="more" color={color} size={20} /> }} />
    </Tabs>
  );
}
