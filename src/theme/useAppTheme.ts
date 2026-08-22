import { useWorkspace } from '@/providers/WorkspaceProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { colors, participantPalettes, radii, shadows, spacing, typography } from './tokens';

export function useAppTheme() {
  const { myColor, partnerColor } = useWorkspace();
  const { preferences } = usePreferences();
  const me = participantPalettes[myColor];
  const partner = participantPalettes[partnerColor];
  const highContrast = preferences.high_contrast;

  return {
    scheme: 'dark' as const,
    name: 'Dual Orbit' as const,
    myColor,
    partnerColor,
    participantPalettes,
    reducedMotion: preferences.reduced_motion,
    haptics: preferences.haptics,
    highContrast,
    colors: {
      ...colors.cosmic,
      card: highContrast ? '#16131B' : colors.cosmic.card,
      cardElevated: highContrast ? '#211C29' : colors.cosmic.cardElevated,
      textSecondary: highContrast ? '#E6DFEC' : colors.cosmic.textSecondary,
      textMuted: highContrast ? '#C1B7C9' : colors.cosmic.textMuted,
      border: highContrast ? '#665B70' : colors.cosmic.border,
      accent: me.accent,
      accentStrong: me.accentStrong,
      accentSoft: me.accentSoft,
      onAccent: me.onAccent,
      partnerAccent: partner.accent,
      partnerAccentStrong: partner.accentStrong,
      partnerAccentSoft: partner.accentSoft,
      partnerOnAccent: partner.onAccent,
      skyGlow: me.glow,
      skyGlowSoft: partner.glowSoft,
    },
    spacing,
    radii,
    shadows,
    typography,
  } as const;
}

export type AppTheme = ReturnType<typeof useAppTheme>;
