import { Pressable, View } from 'react-native';
import { AppText } from './AppText';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <AppText variant="section" style={{ flex: 1 }}>{title}</AppText>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} disabled={!onAction}>
          <AppText variant="bodySmall" tone="accent">{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
