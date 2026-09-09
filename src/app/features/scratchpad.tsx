import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { SharedScratchpadCard } from '@/components/dashboard/SharedScratchpadCard';

// I1_FULLSCREEN_SCRATCHPAD_DRAWING: Draw mode now exposes a genuine fullscreen workspace while keeping the same shared item.
export default function ScratchpadScreen() {
  return (
    <AppScreen>
      <BackHeader eyebrow="Notes" title="Shared scratchpad" subtitle="Write together, or switch to Draw for a fullscreen canvas." />
      <SharedScratchpadCard />
    </AppScreen>
  );
}
