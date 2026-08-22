import { View } from 'react-native';
import type { Activity } from '@/types/product';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { TagChip } from '@/components/common/TagChip';
import { useAppTheme } from '@/theme/useAppTheme';

export function ActivityCard({ activity }: { activity: Activity }) {
  const theme = useAppTheme();
  return (
    <Card style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="pageTitle" tone="accent">{activity.emoji}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="cardTitle">{activity.title}</AppText>
          <AppText variant="caption" tone="muted">{activity.duration} · ♥ {activity.interested}</AppText>
        </View>
      </View>
      <AppText variant="bodySmall" tone="secondary">{activity.description}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {activity.tags.map((tag) => <TagChip key={tag} label={tag} subtle />)}
      </View>
    </Card>
  );
}
