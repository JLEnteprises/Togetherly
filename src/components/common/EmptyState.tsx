import { View } from 'react-native';
import { AppText } from './AppText';
import { EyebrowText } from './EyebrowText';
import { AppButton } from './AppButton';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, isAppIconName } from '@/components/art/AppIcon';

type Props = {
  icon: string;
  title: string;
  body: string;
  eyebrow?: string;
  tip?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

// F2_EMPTY_STATE_COACHING: empty states explain the next useful move instead of only describing missing content.
export function EmptyState({ icon, title, body, eyebrow, tip, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }: Props) {
  const theme = useAppTheme();
  return (
    <Card tone="secondary" style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl, paddingHorizontal: theme.spacing.xl }}>
      <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 62 }}>
        {isAppIconName(icon) ? <AppIcon name={icon} size={34} color={theme.colors.accent} /> : <AppText variant="hero" tone="accent">{icon}</AppText>}
      </View>
      <View style={{ gap: 5, alignItems: 'center' }}>
        {eyebrow ? <EyebrowText tone="secondary">{eyebrow}</EyebrowText> : null}
        <AppText variant="section" align="center">{title}</AppText>
        <AppText tone="secondary" align="center">{body}</AppText>
      </View>
      {tip ? (
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.elevatedBackground }}>
          <AppIcon name="spark" size={17} color={theme.colors.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" tone="accent">TRY THIS</AppText>
            <AppText variant="bodySmall" tone="secondary">{tip}</AppText>
          </View>
        </View>
      ) : null}
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <View style={{ width: '100%', gap: theme.spacing.sm }}>
          {actionLabel && onAction ? <AppButton compact label={actionLabel} onPress={onAction} /> : null}
          {secondaryActionLabel && onSecondaryAction ? <AppButton compact variant="ghost" label={secondaryActionLabel} onPress={onSecondaryAction} /> : null}
        </View>
      ) : null}
    </Card>
  );
}
