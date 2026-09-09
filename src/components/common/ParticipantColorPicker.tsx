import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { ParticipantColor } from '@/types/database';
import {
  normalizeParticipantColor, participantColorPresets, participantColorsTooClose, participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';
import { FormField } from './FormField';

export function ParticipantColorPicker({
  value,
  onChange,
  partnerColor,
  label = 'YOUR COLOUR',
}: {
  value: ParticipantColor;
  onChange: (value: ParticipantColor) => void;
  partnerColor?: ParticipantColor | null;
  label?: string;
}) {
  const theme = useAppTheme();
  const normalized = normalizeParticipantColor(value);
  const [custom, setCustom] = useState(normalized);
  useEffect(() => { setCustom(normalized); }, [normalized]);

  const tooClose = Boolean(partnerColor && participantColorsTooClose(normalized, partnerColor));

  function changeCustom(next: string) {
    const cleaned = next.trim().toUpperCase();
    setCustom(cleaned);
    if (/^#[0-9A-F]{6}$/.test(cleaned)) onChange(cleaned);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <AppText variant="bodySmall" tone="secondary">
        This colour identifies you — Togetherly controls stay neutral.
      </AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {participantColorPresets.map((option) => {
          const selected = normalized === option.value;
          const palette = participantPalette(option.value);
          const conflicts = Boolean(partnerColor && participantColorsTooClose(option.value, partnerColor));
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}${selected ? ', selected' : ''}${conflicts ? ', similar to partner colour' : ''}`}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: palette.accent,
                borderWidth: selected ? 3 : 1,
                borderColor: selected ? theme.colors.textPrimary : conflicts ? theme.colors.warning : palette.border,
                opacity: pressed ? 0.7 : conflicts ? 0.68 : 1,
                transform: [{ scale: selected ? 1.07 : 1 }],
              })}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: participantPalette(normalized).accent, borderWidth: 2, borderColor: participantPalette(normalized).border }} />
        <View style={{ flex: 1 }}>
          <FormField
            label="CUSTOM · #RRGGBB"
            value={custom}
            onChangeText={changeCustom}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            placeholder="#78A9FF"
          />
        </View>
      </View>

      {tooClose ? (
        <AppText variant="bodySmall" tone="warning">
          Choose something more distinct from your partner so you can recognise each other instantly.
        </AppText>
      ) : null}
    </View>
  );
}
