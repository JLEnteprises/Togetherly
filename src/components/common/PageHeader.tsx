import { type Chapter } from '@/components/art/ChapterArt';
import { View } from 'react-native';
import { AppText } from './AppText';
import { ScreenTitle } from './ScreenTitle';
import { CoupleAvatar } from './Avatar';
import { useAppTheme } from '@/theme/useAppTheme';

// Hub titles match detail breadcrumbs; keep legacy props compatible without extra banners.
export function PageHeader({ title, subtitle }: { eyebrow?: string; title: string; subtitle?: string; chapter?: Chapter }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.md, gap: 3 }}>
          <ScreenTitle title={title} />
        </View>
        <CoupleAvatar />
      </View>
      {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
    </View>
  );
}
