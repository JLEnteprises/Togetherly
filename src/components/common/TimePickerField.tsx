import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';
import { AppButton } from './AppButton';
import { ChoiceChips } from './ChoiceChips';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon } from '@/components/art/AppIcon';

type Props = { label: string; value: string; onChange: (value: string) => void };

function parse(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { hour: 19, minute: 0 };
  return { hour: Math.min(23, Number(match[1])), minute: [0,15,30,45].includes(Number(match[2])) ? Number(match[2]) : 0 };
}
function labelFor(hour: number, minute: number) {
  const date = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function TimePickerField({ label, value, onChange }: Props) {
  const theme = useAppTheme();
  const parsed = useMemo(() => parse(value), [value]);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  const setHour12 = (nextHour: number) => setHour(period === 'pm' ? (nextHour % 12) + 12 : nextHour % 12);
  const setPeriod = (nextPeriod: 'am' | 'pm') => setHour(nextPeriod === 'pm' ? (hour12 % 12) + 12 : hour12 % 12);
  const commit = () => { onChange(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`); setVisible(false); };
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${labelFor(parsed.hour, parsed.minute)}`} onPress={() => { setHour(parsed.hour); setMinute(parsed.minute); setVisible(true); }} style={({ pressed }) => ({ minHeight: 50, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: pressed ? 0.75 : 1 })}>
        <AppText>{labelFor(parsed.hour, parsed.minute)}</AppText><AppIcon name="time" size={19} color={theme.colors.accent} />
      </Pressable>
      <Modal transparent visible={visible} animationType={theme.reducedMotion ? 'none' : 'fade'} onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: theme.spacing.lg }}>
          <Card style={{ gap: theme.spacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
            <AppText variant="section">Choose time</AppText>
            <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">HOUR</AppText><ChoiceChips value={String(hour12)} onChange={(v) => setHour12(Number(v))} options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} /></View>
            <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">MINUTE</AppText><ChoiceChips value={String(minute)} onChange={(v) => setMinute(Number(v))} options={[0,15,30,45].map((m) => ({ value: String(m), label: `:${String(m).padStart(2, '0')}` }))} /></View>
            <ChoiceChips value={period} onChange={(v) => setPeriod(v as 'am' | 'pm')} options={[{ value: 'am', label: 'AM' }, { value: 'pm', label: 'PM' }]} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}><AppButton compact variant="ghost" label="Cancel" onPress={() => setVisible(false)} /><AppButton compact label={`Use ${labelFor(hour, minute)}`} onPress={commit} /></View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
