import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from './AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, isAppIconName } from '@/components/art/AppIcon';

type Props = {
  icon: string;
  title: string;
  subtitle: string;
  accent?: boolean;
  href?: string;
  onPress?: () => void;
};

export function FeatureTile({ icon, title, subtitle, accent = false, href, onPress }: Props) {
  const theme = useAppTheme();
  const handlePress = onPress ?? (href ? () => router.push(href as never) : undefined);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={handlePress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: '46%',
        padding: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        backgroundColor: accent ? theme.colors.accentSoft : theme.colors.card,
        borderWidth: 1,
        borderColor: accent ? theme.colors.accent : theme.colors.border,
        opacity: pressed ? 0.76 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
        gap: theme.spacing.sm,
      })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: accent ? theme.colors.accentSoft : theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}>
        {isAppIconName(icon)
          ? <AppIcon name={icon} size={21} color={accent ? theme.colors.accent : theme.colors.textSecondary} />
          : <AppText variant="section" tone={accent ? 'accent' : 'secondary'}>{icon}</AppText>}
      </View>
      <AppText variant="cardTitle">{title}</AppText>
      <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText>
      {handlePress ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><AppText variant="caption" tone="muted">OPEN</AppText><AppIcon name="chevron" size={12} color={theme.colors.textMuted} /></View> : null}
    </Pressable>
  );
}
