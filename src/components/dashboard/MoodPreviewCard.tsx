import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { TagChip } from '@/components/common/TagChip';
import { getLatestMoods } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { MoodEntry } from '@/types/database';

const labels: Record<string, string> = { amazing: '😄 Amazing', good: '🙂 Good', okay: '😐 Okay', low: '😔 Low', frustrated: '😡 Frustrated', overwhelmed: '😫 Overwhelmed', tired: '😴 Tired', stressed: '😰 Stressed' };
export function MoodPreviewCard() {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  const [mine, setMine] = useState<MoodEntry | null>(null); const [partner, setPartner] = useState<MoodEntry | null>(null);
  const refresh = useCallback(async () => { const result = await getLatestMoods(); setMine(result.mine); setPartner(result.partner); }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('moods', refresh);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/features/mood' as never)}>
      {({ pressed }) => <Card participantColor="both" style={{ gap: theme.spacing.md, opacity: pressed ? 0.76 : 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><AppText variant="cardTitle">How are we?</AppText><TagChip subtle label="CHECK IN ›" /></View><View style={{ flexDirection: 'row', gap: theme.spacing.md }}><View style={{ flex: 1 }}><AppText variant="caption" style={{ color: participantPalettes[myColor].accent }}>{profile?.display_name?.toUpperCase() ?? 'ME'}</AppText><AppText variant="bodySmall">{mine ? labels[mine.mood] : 'No check-in yet'}</AppText></View><View style={{ flex: 1 }}><AppText variant="caption" style={{ color: participantPalettes[partnerColor].accent }}>{partnerProfile?.display_name?.toUpperCase() ?? 'WAITING'}</AppText><AppText variant="bodySmall">{partner ? labels[partner.mood] : 'No shared check-in'}</AppText></View></View></Card>}
    </Pressable>
  );
}
