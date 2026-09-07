import { View } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, isAppIconName } from '@/components/art/AppIcon';

export function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: string; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useAppTheme();
  return (
    <Card tone="secondary" style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl }}>
      <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 62 }}>
        {isAppIconName(icon) ? <AppIcon name={icon} size={34} color={theme.colors.accent} /> : <AppText variant="hero" tone="accent">{icon}</AppText>}
      </View>
      <View style={{ gap: 5, alignItems: 'center' }}>
        <AppText variant="section" align="center">{title}</AppText>
        <AppText tone="secondary" align="center">{body}</AppText>
      </View>
      {actionLabel && onAction ? <AppButton compact label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
}
