import { View } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';

export function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: string; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useAppTheme();
  return (
    <Card tone="secondary" style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl }}>
      <AppText variant="hero" tone="accent">{icon}</AppText>
      <View style={{ gap: 5, alignItems: 'center' }}>
        <AppText variant="section" align="center">{title}</AppText>
        <AppText tone="secondary" align="center">{body}</AppText>
      </View>
      {actionLabel && onAction ? <AppButton compact label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
}
