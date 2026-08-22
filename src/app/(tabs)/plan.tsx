import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { useAppTheme } from '@/theme/useAppTheme';

const organise = [
  { icon: '✓', title: 'Tasks', subtitle: 'Assignments, due dates and checklists', href: '/features/tasks' },
  { icon: '≡', title: 'Lists', subtitle: 'Shopping, packing and shared lists', href: '/features/lists' },
  { icon: '✎', title: 'Notes', subtitle: 'Shared notes, private notes and scratchpad', href: '/features/notes' },
] as const;

const dates = [
  { icon: '▦', title: 'Calendar', subtitle: 'Month, week and agenda', href: '/features/calendar' },
  { icon: '⌛', title: 'Countdowns', subtitle: 'Visits, anniversaries and milestones', href: '/features/countdowns' },
  { icon: '◷', title: 'Availability', subtitle: 'Schedules and shared free time', href: '/features/availability' },
] as const;

const biggerPlans = [
  { icon: '✈', title: 'Trips', subtitle: 'Travel plans in one place', href: '/features/trips' },
  { icon: '◎', title: 'Goals', subtitle: 'Goals you can build together', href: '/features/goals' },
] as const;

const tools = [
  { icon: '#', title: 'Tags', subtitle: 'Labels for plans and memories', href: '/features/tags' },
] as const;

export default function PlanScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <PageHeader eyebrow="Shared life" title="Plan" subtitle="Tasks, dates and plans for everyday life." />
      <View style={{ gap: theme.spacing.lg }}>
        <FeatureGroupCard eyebrow="EVERYDAY" title="Organise" subtitle="Tasks, lists and notes." items={organise} accent />
        <FeatureGroupCard eyebrow="WHEN" title="Dates & time" subtitle="Calendar, countdowns and free time." items={dates} />
        <FeatureGroupCard eyebrow="LOOKING AHEAD" title="Bigger plans" subtitle="Trips and goals." items={biggerPlans} />
        <FeatureGroupCard eyebrow="OPTIONAL" title="Organisation tools" items={tools} />
      </View>
    </AppScreen>
  );
}
