import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { useAppTheme } from '@/theme/useAppTheme';

const organise = [
  { icon: 'task', title: 'Tasks', subtitle: 'What needs doing, without the mental load', href: '/features/tasks' },
  { icon: 'list', title: 'Lists', subtitle: 'Shopping, packing and shared lists', href: '/features/lists' },
  { icon: 'note', title: 'Notes', subtitle: 'Writing worth keeping, shared or private', href: '/features/notes' },
] as const;

const dates = [
  { icon: 'calendar', title: 'Calendar', subtitle: 'Month, week and agenda', href: '/features/calendar' },
  { icon: 'countdown', title: 'Countdowns', subtitle: 'Visits, anniversaries and milestones', href: '/features/countdowns' },
  { icon: 'availability', title: 'When are we both free?', subtitle: 'Find the overlap without comparing calendars by hand', href: '/features/availability' },
] as const;

const biggerPlans = [
  { icon: 'trip', title: 'Trips', subtitle: 'Everything for the next time you’re going somewhere together', href: '/features/trips' },
  { icon: 'goal', title: 'Goals', subtitle: 'Goals you can build together', href: '/features/goals' },
] as const;

export default function PlanScreen() {
  const theme = useAppTheme();
  return (
    <AppScreen>
      <PageHeader eyebrow="Shared life" title="Plan" subtitle="The practical bits of life you’re building together." />
      <View style={{ gap: theme.spacing.lg }}>
        <FeatureGroupCard eyebrow="EVERYDAY" title="Day to day" subtitle="Keep the little things from living in your heads." items={organise} accent />
        <FeatureGroupCard eyebrow="WHEN" title="Dates worth keeping" subtitle="What’s happening, what’s coming, and when you’re both free." items={dates} />
        <FeatureGroupCard eyebrow="LOOKING AHEAD" title="Things you’re building toward" subtitle="Trips, goals and the bigger stuff ahead." items={biggerPlans} />
      </View>
    </AppScreen>
  );
}
