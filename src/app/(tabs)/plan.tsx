import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { useAppTheme } from '@/theme/useAppTheme';

const organise = [
  { icon: '✓', title: 'Tasks', subtitle: 'Assignments, deadlines and checklists', href: '/features/tasks' },
  { icon: '≡', title: 'Lists', subtitle: 'Shopping, packing and shared lists', href: '/features/lists' },
  { icon: '✎', title: 'Notes', subtitle: 'Shared notes, private notes and scratchpad', href: '/features/notes' },
  { icon: '#', title: 'Tags', subtitle: 'Labels for plans and memories', href: '/features/tags' },
] as const;

const dates = [
  { icon: '▦', title: 'Calendar', subtitle: 'Month, week and agenda', href: '/features/calendar' },
  { icon: '⌛', title: 'Countdowns', subtitle: 'Visits, anniversaries and milestones', href: '/features/countdowns' },
  { icon: '◷', title: 'Availability', subtitle: 'Schedules and shared free time', href: '/features/availability' },
] as const;

const biggerPlans = [
  { icon: '✈', title: 'Trips', subtitle: 'Travel plans and linked details', href: '/features/trips' },
  { icon: '◎', title: 'Goals', subtitle: 'Goals you can build together', href: '/features/goals' },
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
