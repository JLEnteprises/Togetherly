import { useWorkspace } from '@/providers/WorkspaceProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { colors, participantPalettes, radii, shadows, spacing, typography, participantPalette } from './tokens';

export function useAppTheme() {
  const { myColor, partnerColor } = useWorkspace();
  const { preferences } = usePreferences();
  const me = participantPalette(myColor);
  const partner = participantPalette(partnerColor);
  const highContrast = preferences.high_contrast;

  return {
    scheme: 'dark' as const,
    name: 'Dual Orbit' as const,
    myColor,
    partnerColor,
    participantPalettes,
    participantPalette,
    participants: { me, partner },
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

      // Generic controls intentionally remain neutral.
      accent: colors.cosmic.accent,
      accentStrong: colors.cosmic.accentStrong,
      accentSoft: colors.cosmic.accentSoft,
      onAccent: colors.cosmic.onAccent,

      // Explicit partner/person surfaces can still use these compatibility keys.
      partnerAccent: partner.accent,
      partnerAccentStrong: partner.accentStrong,
      partnerAccentSoft: partner.accentSoft,
      partnerOnAccent: partner.onAccent,

      // Background identity hints stay deliberately subtle.
      skyGlow: me.glowSoft,
      skyGlowSoft: partner.glowSoft,
    },
    spacing,
    radii,
    shadows,
    typography,
  } as const;
}

export type AppTheme = ReturnType<typeof useAppTheme>;
