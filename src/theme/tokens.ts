export type ParticipantPalette = {
  base: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  tint: string;
  border: string;
  glow: string;
  glowSoft: string;
  onAccent: string;
  label: string;
};

export const LEGACY_PURPLE_COLOR = '#BE9AFF';
export const LEGACY_GREEN_COLOR = '#B7CB7C';

export const participantColorPresets = [
  { label: 'Violet', value: '#BE9AFF' },
  { label: 'Blue', value: '#78A9FF' },
  { label: 'Sky', value: '#74C7EC' },
  { label: 'Cyan', value: '#6FD3E8' },
  { label: 'Teal', value: '#69D1BE' },
  { label: 'Emerald', value: '#77D69C' },
  { label: 'Green', value: '#B7CB7C' },
  { label: 'Amber', value: '#E7B76A' },
  { label: 'Orange', value: '#F39A6B' },
  { label: 'Coral', value: '#F08383' },
  { label: 'Rose', value: '#F08FB1' },
  { label: 'Pink', value: '#E79AE8' },
] as const;

const HEX = /^#[0-9A-F]{6}$/;
const paletteCache = new Map<string, ParticipantPalette>();

function clamp(value: number) { return Math.max(0, Math.min(255, Math.round(value))); }
function hexByte(value: number) { return clamp(value).toString(16).padStart(2, '0').toUpperCase(); }
function rgb(value: string) {
  const normalized = normalizeParticipantColor(value);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}
function mix(value: string, target: '#FFFFFF' | '#000000', amount: number) {
  const source = rgb(value);
  const goal = target === '#FFFFFF' ? 255 : 0;
  return `#${hexByte(source.r + (goal - source.r) * amount)}${hexByte(source.g + (goal - source.g) * amount)}${hexByte(source.b + (goal - source.b) * amount)}`;
}
function rgba(value: string, alpha: number) {
  const color = rgb(value);
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}
function luminance(value: string) {
  const color = rgb(value);
  const channels = [color.r, color.g, color.b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function isParticipantColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toUpperCase();
  return HEX.test(normalized) || normalized === 'PURPLE' || normalized === 'GREEN';
}

export function normalizeParticipantColor(value: unknown, fallback = LEGACY_PURPLE_COLOR) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'PURPLE') return LEGACY_PURPLE_COLOR;
  if (normalized === 'GREEN') return LEGACY_GREEN_COLOR;
  return HEX.test(normalized) ? normalized : fallback;
}

export function participantColorsTooClose(left: string, right: string) {
  const a = rgb(left);
  const b = rgb(right);
  const distance = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
  return distance < 72;
}

export function suggestDistinctParticipantColor(taken: string) {
  return participantColorPresets.find((option) => !participantColorsTooClose(option.value, taken))?.value ?? LEGACY_GREEN_COLOR;
}

export function participantPalette(value: string): ParticipantPalette {
  const base = normalizeParticipantColor(value);
  const cached = paletteCache.get(base);
  if (cached) return cached;

  // Very dark custom colours are lifted for UI legibility while preserving the
  // selected base colour as the identity value stored in the database.
  const visible = luminance(base) < 0.13 ? mix(base, '#FFFFFF', 0.42) : base;
  const palette: ParticipantPalette = {
    base,
    accent: visible,
    accentStrong: luminance(visible) > 0.62 ? mix(visible, '#000000', 0.18) : mix(visible, '#FFFFFF', 0.10),
    accentSoft: rgba(visible, 0.14),
    tint: rgba(visible, 0.10),
    border: rgba(visible, 0.50),
    glow: rgba(visible, 0.20),
    glowSoft: rgba(visible, 0.09),
    onAccent: luminance(visible) > 0.54 ? '#111015' : '#FFFFFF',
    label: participantColorPresets.find((option) => option.value === base)?.label ?? base,
  };
  paletteCache.set(base, palette);
  return palette;
}

// Compatibility surface: existing feature screens can keep indexing
// participantPalettes[color]. It now supports any #RRGGBB identity colour.
export const participantPalettes: Record<string, ParticipantPalette> = new Proxy(
  {},
  {
    get: (_target, property) => typeof property === 'string' ? participantPalette(property) : undefined,
  },
);

export const colors = {
  cosmic: {
    background: '#0B0A0F',
    elevatedBackground: '#141218',
    card: '#19161E',
    cardElevated: '#211C28',
    textPrimary: '#F6F2FA',
    textSecondary: '#C9C1D0',
    textMuted: '#8F8798',

    // Togetherly controls stay neutral. Participant colours are reserved for
    // identity/ownership and are supplied separately by useAppTheme().
    accent: '#DED7E5',
    accentStrong: '#F0EBF4',
    accentSoft: '#28242D',
    onAccent: '#151219',

    // Kept for compatibility with partner-specific UI. useAppTheme overrides
    // these with the current partner identity colour.
    partnerAccent: '#D1C6DB',
    partnerAccentStrong: '#E4DDE9',
    partnerAccentSoft: '#242029',
    partnerOnAccent: '#151219',

    secondaryAccent: '#D1C6DB',
    secondarySoft: '#242029',
    success: '#73C7AB',
    warning: '#DEAE70',
    error: '#E47E95',
    border: 'rgba(215, 202, 224, 0.14)',
    overlay: 'rgba(5, 4, 8, 0.74)',
    shadow: '#000000',
    tabBar: 'rgba(14, 12, 18, 0.98)',
    skyGlow: 'rgba(215, 202, 224, 0.08)',
    skyGlowSoft: 'rgba(215, 202, 224, 0.04)',
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
