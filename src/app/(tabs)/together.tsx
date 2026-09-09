import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';
import { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';
import { HomeConnectionActions } from '@/components/dashboard/HomeConnectionActions';
import { RightNowActivityCard } from '@/components/together/RightNowActivityCard';
import { TogetherHubGroups } from '@/components/together/TogetherHubGroups';
import { useAppTheme } from '@/theme/useAppTheme';

// G3_TOGETHER_CONSOLIDATION: Together is the canonical home for connection, check-in, play and date ideas.
export default function TogetherScreen() {
  const theme = useAppTheme();

  return (
    <AppScreen>
      <PageHeader eyebrow="Right now" title="Connect" subtitle="A little time for the two of you." />

      <View style={{ gap: theme.spacing.lg }}>
        {/* E3_PAIRED_COUPLE_IDENTITY */}

        <PartnerPresencePill scope="together" />

        <HomeConnectionActions context="together" />
        <RightNowActivityCard />
        <TogetherHubGroups />
      </View>
    </AppScreen>
  );
}
