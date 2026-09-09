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
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useHomeLayout, type HomeCardKey } from '@/hooks/useHomeLayout';
import { useAppTheme } from '@/theme/useAppTheme';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const { profile, couple, partnerProfile } = useWorkspace();
  const { orderedVisible } = useHomeLayout(profile?.id);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date());

  function renderSection(key: HomeCardKey) {
    if (key === 'today') return <HomeTodayCard key={key} />;
    if (key === 'scratchpad') return couple ? <SharedScratchpadCard key={key} compact /> : null;
    if (key === 'distance') return couple?.long_distance_enabled ? <LongDistanceOverviewCard key={key} /> : null;
    return <HomeQuickActions key={key} />;
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

        {couple && partnerProfile ? <HomeConnectionActions /> : null}

        {orderedVisible.map((item) => renderSection(item.key))}
      </View>
    </AppScreen>
  );
}
