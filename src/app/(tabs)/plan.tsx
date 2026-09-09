import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { PlanHubGroups } from '@/components/plan/PlanHubGroups';
import { useAppTheme } from '@/theme/useAppTheme';

// G4_PLAN_EXPANDABLE_GROUPS: Plan uses compact live summaries and reveals one practical feature group at a time.
export default function PlanScreen() {
  const theme = useAppTheme();

  return (
    <AppScreen>
      <PageHeader eyebrow="Shared life" title="Plan" subtitle="The practical bits of life you’re building together." />
      <View style={{ gap: theme.spacing.lg }}>
        <PlanHubGroups />
      </View>
    </AppScreen>
  );
}
