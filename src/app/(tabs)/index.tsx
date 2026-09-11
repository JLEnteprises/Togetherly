import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { RecentMemoryCard } from '@/components/dashboard/RecentMemoryCard';
import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { InvitePartnerCard } from '@/components/dashboard/InvitePartnerCard';
import { HomeTodayCard } from '@/components/dashboard/HomeTodayCard';
import { HomeConnectionActions } from '@/components/dashboard/HomeConnectionActions';
import { LongDistanceOverviewCard } from '@/components/dashboard/LongDistanceOverviewCard';
import { HomeQuickActions } from '@/components/dashboard/HomeQuickActions';
import { SharedScratchpadCard } from '@/components/dashboard/SharedScratchpadCard';
import { FirstTimeGuideCard } from '@/components/dashboard/FirstTimeGuideCard';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useHomeLayout, type HomeCardKey } from '@/hooks/useHomeLayout';
import { useAppTheme } from '@/theme/useAppTheme';

// F1_FIRST_TIME_USER_GUIDANCE: Home gives newly onboarded accounts a lightweight map of what to do first.
export default function HomeScreen() {
  const theme = useAppTheme();
  const { profile, couple, partnerProfile } = useWorkspace();
  const { orderedVisible } = useHomeLayout(profile?.id);
  function renderSection(key: HomeCardKey) {
    if (key === 'today') return <HomeTodayCard key={key} />;
    if (key === 'distance') return couple?.long_distance_enabled ? <LongDistanceOverviewCard key={key} /> : null;
    if (key === 'scratchpad') return couple ? <SharedScratchpadCard key={key} compact /> : null;
    if (key === 'quickActions') return <HomeQuickActions key={key} />;
    return null;
  }

  return (
    <AppScreen>
      <View style={{ gap: theme.spacing.xl }}>
        <HomeHeader />

        <InvitePartnerCard />
        <FirstTimeGuideCard />

        {couple && partnerProfile ? <HomeConnectionActions /> : null}
        {orderedVisible.map((item) => renderSection(item.key))}
        <RecentMemoryCard />
      </View>
    </AppScreen>
  );
}
