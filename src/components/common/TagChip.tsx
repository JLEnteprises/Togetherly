import { View } from 'react-native';
import type { DrawingData, ParticipantColor } from '@/types/database';
import { participantPalettes } from '@/theme/tokens';
import { AppText } from './AppText';
import { DrawnIcon } from './DrawingCanvas';
import { useAppTheme } from '@/theme/useAppTheme';

export function TagChip({ label, subtle = false, participantColor, icon, iconDrawing }: { label: string; subtle?: boolean; participantColor?: ParticipantColor | 'both'; icon?: string | null; iconDrawing?: DrawingData | null }) {
  const theme = useAppTheme();
  const palette = participantColor && participantColor !== 'both' ? participantPalettes[participantColor] : null;
  const both = participantColor === 'both';
  const backgroundColor = palette?.tint ?? (subtle ? theme.colors.elevatedBackground : theme.colors.accentSoft);
  const borderColor = palette?.border ?? (both ? participantPalettes.purple.border : theme.colors.border);
  const textColor = palette?.accent ?? (both ? theme.colors.textPrimary : subtle ? theme.colors.textSecondary : theme.colors.accentStrong);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: theme.radii.pill,
        paddingHorizontal: 9,
        paddingVertical: 5,
        backgroundColor,
        borderWidth: 1,
        borderColor,
        ...(both ? { borderRightColor: participantPalettes.green.border, borderRightWidth: 3 } : {}),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {iconDrawing?.strokes?.length ? <DrawnIcon strokes={iconDrawing.strokes} size={14} color={textColor} /> : icon ? <AppText variant="caption" style={{ color: textColor }}>{icon}</AppText> : null}
        <AppText variant="caption" style={{ color: textColor }}>{label}</AppText>
      </View>
    </View>
  );
}
