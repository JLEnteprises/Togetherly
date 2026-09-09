import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';
import { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';
import { HomeConnectionActions } from '@/components/dashboard/HomeConnectionActions';
import { TogetherHubGroups } from '@/components/together/TogetherHubGroups';
import { useAppTheme } from '@/theme/useAppTheme';

// G3_TOGETHER_CONSOLIDATION: Together is the canonical home for connection, check-in, play and date ideas.
export default function TogetherScreen() {
  const theme = useAppTheme();

  return (
    <AppScreen>
      <PageHeader eyebrow="Right now" title="Together" subtitle="The part of your space for actually being together." />

      <View style={{ gap: theme.spacing.lg }}>
        {/* E3_PAIRED_COUPLE_IDENTITY */}
        <CoupleIdentitySignature detail="A space for the two of you to be present together." />
        <PartnerPresencePill scope="together" />

        <HomeConnectionActions context="together" />
        <TogetherHubGroups />
      </View>
    </AppScreen>
  );
}
