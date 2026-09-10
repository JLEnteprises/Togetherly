import { ChapterArt, type Chapter } from '@/components/art/ChapterArt';
import { View } from 'react-native';
import { AppText } from './AppText';
import { EyebrowText } from './EyebrowText';
import { CoupleAvatar } from './Avatar';
import { useAppTheme } from '@/theme/useAppTheme';

// E4_FINAL_VISUAL_CONSISTENCY: page headers use the same eyebrow treatment and internal title rhythm.
export function PageHeader({ eyebrow, title, subtitle, chapter }: { eyebrow?: string; title: string; subtitle?: string; chapter?: Chapter }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.md, gap: 3 }}>
          {eyebrow ? <EyebrowText>{eyebrow}</EyebrowText> : null}
          <AppText variant="hero" accessibilityRole="header">{title}</AppText>
        </View>
        <CoupleAvatar />
      </View>
      {subtitle ? <AppText tone="secondary">{subtitle}</AppText> : null}
      {chapter ? <View style={{ borderRadius: theme.radii.xl, backgroundColor: theme.colors.elevatedBackground, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}><ChapterArt chapter={chapter} /></View> : null}
    </View>
  );
}
