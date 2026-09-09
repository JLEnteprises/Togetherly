import { View } from 'react-native';
import { AppText } from './AppText';
import { EyebrowText } from './EyebrowText';
import { CoupleAvatar } from './Avatar';
import { useAppTheme } from '@/theme/useAppTheme';

// E4_FINAL_VISUAL_CONSISTENCY: page headers use the same eyebrow treatment and internal title rhythm.
export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.md, gap: 3 }}>
          {eyebrow ? <EyebrowText>{eyebrow}</EyebrowText> : null}
          <AppText variant="pageTitle" accessibilityRole="header">{title}</AppText>
        </View>
        <CoupleAvatar />
      </View>
      {subtitle ? <AppText tone="secondary">{subtitle}</AppText> : null}
    </View>
  );
}
