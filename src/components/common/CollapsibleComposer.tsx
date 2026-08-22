import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';

type Props = {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  actionLabel?: string;
  closeLabel?: string;
  tone?: 'default' | 'accent' | 'secondary';
  style?: ViewStyle;
};

export function CollapsibleComposer({ title, subtitle, open, onToggle, children, actionLabel = 'New', closeLabel = 'Close', tone = 'default', style }: Props) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  return (
    <Card tone={open ? tone : 'default'} style={style ? [{ gap: open ? theme.spacing.lg : 0 }, style] : { gap: open ? theme.spacing.lg : 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${open ? closeLabel : actionLabel}: ${title}`}
        accessibilityState={{ expanded: open }}
        onPress={() => { feedback(); onToggle(); }}
        style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, opacity: pressed ? 0.74 : 1 })}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <AppText variant="section">{title}</AppText>
          {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
        </View>
        <View style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: open ? theme.colors.border : theme.colors.accent, backgroundColor: open ? theme.colors.secondarySoft : theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="bodySmall" tone={open ? 'secondary' : 'accent'}>{open ? closeLabel : `＋ ${actionLabel}`}</AppText>
        </View>
      </Pressable>
      {open ? <View style={{ gap: theme.spacing.lg }}>{children}</View> : null}
    </Card>
  );
}
