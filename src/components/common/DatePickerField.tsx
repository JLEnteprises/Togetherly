import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';
import { AppButton } from './AppButton';
import { useAppTheme } from '@/theme/useAppTheme';
import { isValidDateOnly } from '@/utils/dates';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  minimumDate?: string;
};

function toKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function parseKey(value: string) {
  if (!isValidDateOnly(value)) return null;
  const parts = value.split('-').map(Number);
  const y = parts[0] ?? 0; const m = parts[1] ?? 1; const d = parts[2] ?? 1;
  return new Date(y, m - 1, d, 12);
}
function monthCells(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1, 12);
  const start = new Date(year, month, 1 - first.getDay(), 12);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function DatePickerField({ label, value, onChange, optional = false, minimumDate }: Props) {
  const theme = useAppTheme();
  const selected = parseKey(value);
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(() => selected ?? new Date());
  const cells = useMemo(() => monthCells(month), [month]);
  const minimum = minimumDate && isValidDateOnly(minimumDate) ? minimumDate : null;
  const display = selected ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(selected) : optional ? 'Not set' : 'Choose date';
  const moveMonth = (delta: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${display}`} onPress={() => { setMonth(selected ?? new Date()); setVisible(true); }} style={({ pressed }) => ({ minHeight: 50, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: pressed ? 0.75 : 1 })}>
        <AppText tone={selected ? 'primary' : 'muted'}>{display}</AppText>
        <AppText tone="accent">▦</AppText>
      </Pressable>
      <Modal transparent visible={visible} animationType={theme.reducedMotion ? 'none' : 'fade'} onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: theme.spacing.lg }}>
          <Card style={{ gap: theme.spacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} hitSlop={10} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><AppText variant="section" tone="accent">‹</AppText></Pressable>
              <AppText variant="section">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => moveMonth(1)} hitSlop={10} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><AppText variant="section" tone="accent">›</AppText></Pressable>
            </View>
            <View style={{ flexDirection: 'row' }}>{['S','M','T','W','T','F','S'].map((day, index) => <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center' }}><AppText variant="caption" tone="muted">{day}</AppText></View>)}</View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((date) => {
                const key = toKey(date);
                const inMonth = date.getMonth() === month.getMonth();
                const active = key === value;
                const disabled = minimum ? key < minimum : false;
                return (
                  <Pressable key={key} accessibilityRole="button" accessibilityLabel={new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date)} accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={() => { onChange(key); setVisible(false); }} style={({ pressed }) => ({ width: '14.2857%', minHeight: 44, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: active ? theme.colors.accentStrong : 'transparent', opacity: disabled ? 0.25 : pressed ? 0.6 : inMonth ? 1 : 0.42 })}>
                    <AppText variant="bodySmall" style={active ? { color: theme.colors.onAccent } : undefined}>{date.getDate()}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}>
              {optional ? <AppButton compact variant="ghost" label="Clear" onPress={() => { onChange(''); setVisible(false); }} /> : <View />}
              <AppButton compact variant="secondary" label="Close" onPress={() => setVisible(false)} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
