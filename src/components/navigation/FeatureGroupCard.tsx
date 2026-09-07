import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, isAppIconName } from '@/components/art/AppIcon';

type FeatureGroupItem = {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
};

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: readonly FeatureGroupItem[];
  accent?: boolean;
};

export function FeatureGroupCard({ eyebrow, title, subtitle, items, accent = false }: Props) {
  const theme = useAppTheme();
  return (
    <Card tone={accent ? 'accent' : 'default'} style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 4 }}>
        {eyebrow ? <AppText variant="caption" tone={accent ? 'accent' : 'secondary'}>{eyebrow}</AppText> : null}
        <AppText variant="section">{title}</AppText>
        {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
      </View>
      <View>
        {items.map((item, index) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.subtitle}`}
            onPress={() => router.push(item.href as never)}
            style={({ pressed }) => ({
              minHeight: 58,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingVertical: 10,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: theme.colors.border,
              opacity: pressed ? 0.68 : 1,
            })}
          >
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}>
              {isAppIconName(item.icon)
                ? <AppIcon name={item.icon} size={19} color={accent ? theme.colors.accent : theme.colors.textSecondary} />
                : <AppText variant="cardTitle" tone={accent ? 'accent' : 'secondary'}>{item.icon}</AppText>}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="cardTitle">{item.title}</AppText>
              <AppText variant="caption" tone="muted">{item.subtitle}</AppText>
            </View>
            <AppIcon name="chevron" size={17} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
