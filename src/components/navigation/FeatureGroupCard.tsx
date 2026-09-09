import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { EyebrowText } from '@/components/common/EyebrowText';
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

// E4_FINAL_VISUAL_CONSISTENCY: grouped navigation shares one visual hierarchy and touch rhythm.
export function FeatureGroupCard({ eyebrow, title, subtitle, items, accent = false }: Props) {
  const theme = useAppTheme();

  const content = (
    <>
      <View style={{ gap: 4, paddingHorizontal: accent ? 0 : 2 }}>
        {eyebrow ? (
          <EyebrowText tone={accent ? 'accent' : 'secondary'}>{eyebrow}</EyebrowText>
        ) : null}
        <AppText variant="section">{title}</AppText>
        {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
      </View>

      <View
        style={{
          marginTop: accent ? 0 : theme.spacing.xs,
          borderTopWidth: accent ? 0 : 1,
          borderBottomWidth: accent ? 0 : 1,
          borderColor: theme.colors.border,
        }}
      >
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
              paddingHorizontal: accent ? 0 : 2,
              paddingVertical: accent ? 10 : 11,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent',
              borderRadius: pressed ? theme.radii.sm : 0,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: accent ? theme.colors.elevatedBackground : theme.colors.accentSoft,
              }}
            >
              {isAppIconName(item.icon)
                ? <AppIcon name={item.icon} size={18} color={theme.colors.accent} />
                : <AppText variant="cardTitle" tone="accent">{item.icon}</AppText>}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="cardTitle">{item.title}</AppText>
              <AppText variant="caption" tone="muted">{item.subtitle}</AppText>
            </View>

            <AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </>
  );

  if (accent) {
    return (
      <Card tone="accent" style={{ gap: theme.spacing.md }}>
        {content}
      </Card>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {content}
    </View>
  );
}
