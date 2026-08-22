import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { TagChip } from '@/components/common/TagChip';
import { useAppTheme } from '@/theme/useAppTheme';

function choicesFrom(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

export default function DecisionToolsScreen() {
  const theme = useAppTheme();
  const [choicesText, setChoicesText] = useState('');
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const choices = useMemo(() => choicesFrom(choicesText), [choicesText]);

  function choose() {
    if (choices.length < 2) return;
    const selected = choices[Math.floor(Math.random() * choices.length)] ?? choices[0];
    if (!selected) return;
    setWinner(selected);
    setHistory((current) => [selected, ...current].slice(0, 5));
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Decision wheel" subtitle="Put in two to twelve options and let chance settle the tiny decisions." />
      <Card tone="secondary" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
        <AppText variant="section">What are we choosing between?</AppText>
        <FormField label="OPTIONS · ONE PER LINE OR COMMA-SEPARATED" value={choicesText} onChangeText={setChoicesText} multiline placeholder={'First option\nSecond option\nThird option'} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {choices.map((choice, index) => <TagChip key={`${choice}-${index}`} participantColor={index % 2 === 0 ? 'purple' : 'green'} label={choice.toUpperCase()} />)}
        </View>
        {winner ? (
          <Card tone="accent" participantColor="both" style={{ gap: theme.spacing.sm, alignItems: 'center' }}>
            <AppText variant="caption" tone="secondary">THE ORBIT LANDED ON</AppText>
            <AppText variant="pageTitle" style={{ textAlign: 'center' }}>{winner}</AppText>
          </Card>
        ) : null}
        <AppButton label={winner ? 'Spin again' : 'Spin the wheel'} disabled={choices.length < 2} onPress={choose} />
        {choices.length < 2 ? <AppText variant="bodySmall" tone="muted">Add at least two options.</AppText> : null}
      </Card>

      {history.length ? (
        <Card style={{ gap: theme.spacing.md }}>
          <AppText variant="section">Recent picks</AppText>
          {history.map((item, index) => (
            <View key={`${item}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: index === history.length - 1 ? 0 : 1, borderBottomColor: theme.colors.border, paddingBottom: 8 }}>
              <AppText tone="secondary">{item}</AppText><AppText variant="caption" tone="muted">#{index + 1}</AppText>
            </View>
          ))}
        </Card>
      ) : null}
    </AppScreen>
  );
}
