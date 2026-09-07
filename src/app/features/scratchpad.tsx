import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { SharedScratchpadCard } from '@/components/dashboard/SharedScratchpadCard';

export default function ScratchpadScreen() {
  return (
    <AppScreen>
      <BackHeader eyebrow="Notes" title="Shared scratchpad" subtitle="A quick note or sketch for the two of you." />
      <SharedScratchpadCard />
    </AppScreen>
  );
}
