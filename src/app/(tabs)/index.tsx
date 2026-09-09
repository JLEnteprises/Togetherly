import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { CoupleHero } from '@/components/dashboard/CoupleHero';
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

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// F1_FIRST_TIME_USER_GUIDANCE: Home gives newly onboarded accounts a lightweight map of what to do first.
export default function HomeScreen() {
  const theme = useAppTheme();
  const { profile, couple, partnerProfile } = useWorkspace();
  const { orderedVisible } = useHomeLayout(profile?.id);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date());
  const todayVisible = orderedVisible.some((item) => item.key === 'today');
  const distanceVisible = orderedVisible.some((item) => item.key === 'distance');
  const secondarySections = orderedVisible.filter((item) => item.key !== 'today' && item.key !== 'distance');

  function renderSecondarySection(key: HomeCardKey) {
    if (key === 'scratchpad') return couple ? <SharedScratchpadCard key={key} compact /> : null;
    if (key === 'quickActions') return <HomeQuickActions key={key} />;
    return null;
  }

  return (
    <AppScreen>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: 2 }}>
          <AppText variant="bodySmall" tone="muted">{weekday}</AppText>
          <AppText variant="pageTitle">{profile?.display_name ? `${greeting()}, ${profile.display_name}` : greeting()}</AppText>
        </View>

        <InvitePartnerCard />
        <CoupleHero />
        <FirstTimeGuideCard />

        {todayVisible ? <HomeTodayCard /> : null}

        {couple && partnerProfile ? <HomeConnectionActions /> : null}

        {distanceVisible && couple?.long_distance_enabled ? <LongDistanceOverviewCard /> : null}

        {secondarySections.map((item) => renderSecondarySection(item.key))}
      </View>
    </AppScreen>
  );
}
