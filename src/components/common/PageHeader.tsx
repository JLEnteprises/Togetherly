import { View } from 'react-native';
import { AppText } from './AppText';
import { CoupleAvatar } from './Avatar';
import { useAppTheme } from '@/theme/useAppTheme';

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
          {eyebrow ? <AppText variant="caption" tone="accent" style={{ textTransform: 'uppercase', letterSpacing: 1.1 }}>{eyebrow}</AppText> : null}
          <AppText variant="pageTitle" accessibilityRole="header">{title}</AppText>
        </View>
        <CoupleAvatar />
      </View>
      {subtitle ? <AppText tone="secondary">{subtitle}</AppText> : null}
    </View>
  );
}
