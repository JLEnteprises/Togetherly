import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { TagChip } from '@/components/common/TagChip';
import { getDailyQuestion } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useAppTheme } from '@/theme/useAppTheme';
import type { DailyQuestionState } from '@/types/database';

export function DailyQuestionPreviewCard() {
  const theme = useAppTheme();
  const [state, setState] = useState<DailyQuestionState | null>(null);
  const refresh = useCallback(async () => setState(await getDailyQuestion()), []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('questions', refresh);
  const question = state?.question;
  if (!question) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/features/daily-question' as never)}>
      {({ pressed }) => (
        <Card participantColor="both" style={{ gap: theme.spacing.md, opacity: pressed ? 0.76 : 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><AppText variant="caption" tone="secondary">TODAY’S QUESTION</AppText><TagChip subtle label={state.bothAnswered ? 'BOTH ANSWERED' : state.myAnswer ? 'WAITING' : 'OPEN'} /></View>
          <AppText variant="section">{question.question}</AppText>
          <AppText variant="bodySmall" tone="secondary">{state.bothAnswered ? 'Both answers are unlocked. Tap to read them.' : state.myAnswer ? 'Your answer is saved. Your partner’s stays hidden until they answer.' : 'Answer independently, then reveal together.'}</AppText>
        </Card>
      )}
    </Pressable>
  );
}
