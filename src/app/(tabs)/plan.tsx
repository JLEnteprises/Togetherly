import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { useAppTheme } from '@/theme/useAppTheme';

const organise = [
  { icon: 'task', title: 'Tasks', subtitle: 'Assignments, deadlines and checklists', href: '/features/tasks' },
  { icon: 'list', title: 'Lists', subtitle: 'Shopping, packing and shared lists', href: '/features/lists' },
  { icon: 'note', title: 'Notes', subtitle: 'Writing worth keeping, shared or private', href: '/features/notes' },
] as const;

const dates = [
  { icon: 'calendar', title: 'Calendar', subtitle: 'Month, week and agenda', href: '/features/calendar' },
  { icon: 'countdown', title: 'Countdowns', subtitle: 'Visits, anniversaries and milestones', href: '/features/countdowns' },
  { icon: 'availability', title: 'Availability', subtitle: 'Schedules and shared free time', href: '/features/availability' },
] as const;

const biggerPlans = [
  { icon: 'trip', title: 'Trips', subtitle: 'Travel plans and linked details', href: '/features/trips' },
  { icon: 'goal', title: 'Goals', subtitle: 'Goals you can build together', href: '/features/goals' },
] as const;

export default function PlanScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <PageHeader eyebrow="Shared life" title="Plan" />
      <View style={{ gap: theme.spacing.lg }}>
        <FeatureGroupCard eyebrow="EVERYDAY" title="Organise" items={organise} accent />
        <FeatureGroupCard eyebrow="WHEN" title="Dates & time" items={dates} />
        <FeatureGroupCard eyebrow="LOOKING AHEAD" title="Bigger plans" items={biggerPlans} />
      </View>
    </AppScreen>
  );
}
