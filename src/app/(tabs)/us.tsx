import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';
import { UsStoryDashboard } from '@/components/us/UsStoryDashboard';
import { useAppTheme } from '@/theme/useAppTheme';

// G5_US_STORY_CONSOLIDATION: Us is the single relationship-story dashboard for Memories, Photos, Timeline and rediscovery.
export default function UsScreen() {
  const theme = useAppTheme();

  return (
    <AppScreen>
      <PageHeader eyebrow="Our story" title="Us" subtitle="The part of Togetherly that becomes more yours over time." />

      <View style={{ gap: theme.spacing.xl }}>
        {/* E3_PAIRED_COUPLE_IDENTITY */}
        <CoupleIdentitySignature detail="Your shared story belongs to both of you." />
        <UsStoryDashboard />
      </View>
    </AppScreen>
  );
}
