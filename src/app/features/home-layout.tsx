import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { ToggleRow } from '@/components/common/ToggleRow';
import { IconButton } from '@/components/common/IconButton';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useHomeLayout, type HomeCardKey } from '@/hooks/useHomeLayout';
import { useAppTheme } from '@/theme/useAppTheme';

// G2_HOME_DECLUTTER: Home layout labels describe status widgets, not duplicate feature launchers.
const labels: Record<HomeCardKey, { title: string; body: string }> = {
  today: { title: 'Today', body: 'Events, tasks, question and mood status.' },
  scratchpad: { title: 'Scratchpad', body: 'Shared text or drawing.' },
  distance: { title: 'Long distance', body: 'Local times, countdown and shared free time.' },
  quickActions: { title: 'Active game', body: 'Appears only when a shared game is already in progress.' },
};

export default function HomeLayoutScreen() {
  const theme = useAppTheme(); const { profile } = useWorkspace(); const { layout, update, move, reset } = useHomeLayout(profile?.id);
  return <AppScreen>
    <BackHeader eyebrow="Settings" title="Customize Home" subtitle="Choose what appears on Home." />
    <View style={{ gap: theme.spacing.md }}>
      {layout.map((item, index) => <Card key={item.key} style={{ gap: theme.spacing.sm, opacity: item.hidden ? 0.62 : 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}><View style={{ flex: 1 }}><AppText variant="cardTitle">{labels[item.key].title}</AppText><AppText variant="bodySmall" tone="secondary">{labels[item.key].body}</AppText></View><View style={{ flexDirection: 'row', gap: 6 }}><IconButton icon="chevronUp" label={`Move ${labels[item.key].title} up`} disabled={index === 0} onPress={() => move(item.key, -1)} /><IconButton icon="chevronDown" label={`Move ${labels[item.key].title} down`} disabled={index === layout.length - 1} onPress={() => move(item.key, 1)} /></View></View><ToggleRow label="Show on Home" value={!item.hidden} onChange={(value) => update(item.key, { hidden: !value })} /><ToggleRow label="Pin near top" subtitle="Pinned sections stay above unpinned sections." value={item.pinned} onChange={(value) => update(item.key, { pinned: value })} /></Card>)}
    </View>
    <View style={{ marginTop: theme.spacing.xxl }}><AppButton variant="secondary" label="Reset Home layout" onPress={() => reset()} /></View>
  </AppScreen>;
}
