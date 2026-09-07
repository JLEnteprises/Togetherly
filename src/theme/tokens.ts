export const participantPalettes = {
  purple: {
    accent: '#BE9AFF',
    accentStrong: '#9B6AF5',
    accentSoft: '#2B1D42',
    tint: 'rgba(190, 154, 255, 0.12)',
    border: 'rgba(190, 154, 255, 0.48)',
    glow: 'rgba(155, 106, 245, 0.20)',
    glowSoft: 'rgba(155, 106, 245, 0.10)',
    onAccent: '#FFFFFF',
    label: 'Purple',
  },
  green: {
    accent: '#B7CB7C',
    accentStrong: '#99AF61',
    accentSoft: '#222B1B',
    tint: 'rgba(183, 203, 124, 0.12)',
    border: 'rgba(183, 203, 124, 0.48)',
    glow: 'rgba(153, 175, 97, 0.18)',
    glowSoft: 'rgba(153, 175, 97, 0.09)',
    onAccent: '#10140B',
    label: 'Green',
  },
} as const;

export const colors = {
  cosmic: {
    background: '#0B0A0F',
    elevatedBackground: '#141218',
    card: '#19161E',
    cardElevated: '#211C28',
    textPrimary: '#F6F2FA',
    textSecondary: '#C9C1D0',
    textMuted: '#8F8798',
    // These are replaced at runtime with the signed-in partner's identity colour.
    accent: participantPalettes.purple.accent,
    accentStrong: participantPalettes.purple.accentStrong,
    accentSoft: participantPalettes.purple.accentSoft,
    onAccent: participantPalettes.purple.onAccent,
    partnerAccent: participantPalettes.green.accent,
    partnerAccentStrong: participantPalettes.green.accentStrong,
    partnerAccentSoft: participantPalettes.green.accentSoft,
    partnerOnAccent: participantPalettes.green.onAccent,
    secondaryAccent: '#D1C6DB',
    secondarySoft: '#242029',
    success: '#73C7AB',
    warning: '#DEAE70',
    error: '#E47E95',
    border: 'rgba(215, 202, 224, 0.14)',
    overlay: 'rgba(5, 4, 8, 0.74)',
    shadow: '#000000',
    tabBar: 'rgba(14, 12, 18, 0.98)',
    skyGlow: participantPalettes.purple.glow,
    skyGlowSoft: participantPalettes.green.glowSoft,
    star: 'rgba(242, 235, 248, 0.66)',
    moon: '#E7DFED',
    vineSoft: 'rgba(209, 198, 219, 0.18)',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  hero: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.8 },
  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.35 },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '700' as const },
  numeric: { fontSize: 46, lineHeight: 50, fontWeight: '800' as const, letterSpacing: -1.3 },
} as const;

export const shadows = {
  card: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 2,
  },
} as const;
