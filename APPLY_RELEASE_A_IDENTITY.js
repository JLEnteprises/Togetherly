const fs = require('fs');
const path = require('path');

const project = process.cwd();

function file(rel) { return path.join(project, rel); }
function read(rel) {
  if (!fs.existsSync(file(rel))) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file(rel), 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, content) {
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  fs.writeFileSync(file(rel), content.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}
function replaceOnce(rel, oldText, newText, label) {
  let text = read(rel);
  if (text.includes(newText)) { console.log(`Already patched ${rel} (${label})`); return; }
  const index = text.indexOf(oldText);
  if (index < 0) throw new Error(`Could not safely patch ${rel}: ${label}`);
  if (text.indexOf(oldText, index + oldText.length) >= 0) throw new Error(`Multiple matches in ${rel}: ${label}`);
  text = text.replace(oldText, newText);
  write(rel, text);
}
function regexOnce(rel, regex, replacement, label) {
  let text = read(rel);
  const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  if (matches.length === 0) { console.log(`No patch needed ${rel} (${label})`); return; }
  if (matches.length > 1) throw new Error(`Multiple matches in ${rel}: ${label}`);
  text = text.replace(regex, replacement);
  write(rel, text);
}

// Full foundation files.
write('src/theme/tokens.ts', "export type ParticipantPalette = {\n  base: string;\n  accent: string;\n  accentStrong: string;\n  accentSoft: string;\n  tint: string;\n  border: string;\n  glow: string;\n  glowSoft: string;\n  onAccent: string;\n  label: string;\n};\n\nexport const LEGACY_PURPLE_COLOR = '#BE9AFF';\nexport const LEGACY_GREEN_COLOR = '#B7CB7C';\n\nexport const participantColorPresets = [\n  { label: 'Violet', value: '#BE9AFF' },\n  { label: 'Blue', value: '#78A9FF' },\n  { label: 'Sky', value: '#74C7EC' },\n  { label: 'Cyan', value: '#6FD3E8' },\n  { label: 'Teal', value: '#69D1BE' },\n  { label: 'Emerald', value: '#77D69C' },\n  { label: 'Green', value: '#B7CB7C' },\n  { label: 'Amber', value: '#E7B76A' },\n  { label: 'Orange', value: '#F39A6B' },\n  { label: 'Coral', value: '#F08383' },\n  { label: 'Rose', value: '#F08FB1' },\n  { label: 'Pink', value: '#E79AE8' },\n] as const;\n\nconst HEX = /^#[0-9A-F]{6}$/;\nconst paletteCache = new Map<string, ParticipantPalette>();\n\nfunction clamp(value: number) { return Math.max(0, Math.min(255, Math.round(value))); }\nfunction hexByte(value: number) { return clamp(value).toString(16).padStart(2, '0').toUpperCase(); }\nfunction rgb(value: string) {\n  const normalized = normalizeParticipantColor(value);\n  return {\n    r: parseInt(normalized.slice(1, 3), 16),\n    g: parseInt(normalized.slice(3, 5), 16),\n    b: parseInt(normalized.slice(5, 7), 16),\n  };\n}\nfunction mix(value: string, target: '#FFFFFF' | '#000000', amount: number) {\n  const source = rgb(value);\n  const goal = target === '#FFFFFF' ? 255 : 0;\n  return `#${hexByte(source.r + (goal - source.r) * amount)}${hexByte(source.g + (goal - source.g) * amount)}${hexByte(source.b + (goal - source.b) * amount)}`;\n}\nfunction rgba(value: string, alpha: number) {\n  const color = rgb(value);\n  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;\n}\nfunction luminance(value: string) {\n  const color = rgb(value);\n  const channels = [color.r, color.g, color.b].map((channel) => {\n    const c = channel / 255;\n    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;\n  });\n  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;\n}\n\nexport function isParticipantColor(value: unknown): value is string {\n  if (typeof value !== 'string') return false;\n  const normalized = value.trim().toUpperCase();\n  return HEX.test(normalized) || normalized === 'PURPLE' || normalized === 'GREEN';\n}\n\nexport function normalizeParticipantColor(value: unknown, fallback = LEGACY_PURPLE_COLOR) {\n  if (typeof value !== 'string') return fallback;\n  const normalized = value.trim().toUpperCase();\n  if (normalized === 'PURPLE') return LEGACY_PURPLE_COLOR;\n  if (normalized === 'GREEN') return LEGACY_GREEN_COLOR;\n  return HEX.test(normalized) ? normalized : fallback;\n}\n\nexport function participantColorsTooClose(left: string, right: string) {\n  const a = rgb(left);\n  const b = rgb(right);\n  const distance = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);\n  return distance < 72;\n}\n\nexport function suggestDistinctParticipantColor(taken: string) {\n  return participantColorPresets.find((option) => !participantColorsTooClose(option.value, taken))?.value ?? LEGACY_GREEN_COLOR;\n}\n\nexport function participantPalette(value: string): ParticipantPalette {\n  const base = normalizeParticipantColor(value);\n  const cached = paletteCache.get(base);\n  if (cached) return cached;\n\n  // Very dark custom colours are lifted for UI legibility while preserving the\n  // selected base colour as the identity value stored in the database.\n  const visible = luminance(base) < 0.13 ? mix(base, '#FFFFFF', 0.42) : base;\n  const palette: ParticipantPalette = {\n    base,\n    accent: visible,\n    accentStrong: luminance(visible) > 0.62 ? mix(visible, '#000000', 0.18) : mix(visible, '#FFFFFF', 0.10),\n    accentSoft: rgba(visible, 0.14),\n    tint: rgba(visible, 0.10),\n    border: rgba(visible, 0.50),\n    glow: rgba(visible, 0.20),\n    glowSoft: rgba(visible, 0.09),\n    onAccent: luminance(visible) > 0.54 ? '#111015' : '#FFFFFF',\n    label: participantColorPresets.find((option) => option.value === base)?.label ?? base,\n  };\n  paletteCache.set(base, palette);\n  return palette;\n}\n\n// Compatibility surface: existing feature screens can keep indexing\n// participantPalettes[color]. It now supports any #RRGGBB identity colour.\nexport const participantPalettes: Record<string, ParticipantPalette> = new Proxy(\n  {},\n  {\n    get: (_target, property) => typeof property === 'string' ? participantPalette(property) : undefined,\n  },\n);\n\nexport const colors = {\n  cosmic: {\n    background: '#0B0A0F',\n    elevatedBackground: '#141218',\n    card: '#19161E',\n    cardElevated: '#211C28',\n    textPrimary: '#F6F2FA',\n    textSecondary: '#C9C1D0',\n    textMuted: '#8F8798',\n\n    // Togetherly controls stay neutral. Participant colours are reserved for\n    // identity/ownership and are supplied separately by useAppTheme().\n    accent: '#DED7E5',\n    accentStrong: '#F0EBF4',\n    accentSoft: '#28242D',\n    onAccent: '#151219',\n\n    // Kept for compatibility with partner-specific UI. useAppTheme overrides\n    // these with the current partner identity colour.\n    partnerAccent: '#D1C6DB',\n    partnerAccentStrong: '#E4DDE9',\n    partnerAccentSoft: '#242029',\n    partnerOnAccent: '#151219',\n\n    secondaryAccent: '#D1C6DB',\n    secondarySoft: '#242029',\n    success: '#73C7AB',\n    warning: '#DEAE70',\n    error: '#E47E95',\n    border: 'rgba(215, 202, 224, 0.14)',\n    overlay: 'rgba(5, 4, 8, 0.74)',\n    shadow: '#000000',\n    tabBar: 'rgba(14, 12, 18, 0.98)',\n    skyGlow: 'rgba(215, 202, 224, 0.08)',\n    skyGlowSoft: 'rgba(215, 202, 224, 0.04)',\n    star: 'rgba(242, 235, 248, 0.66)',\n    moon: '#E7DFED',\n    vineSoft: 'rgba(209, 198, 219, 0.18)',\n  },\n} as const;\n\nexport const spacing = {\n  xs: 4,\n  sm: 8,\n  md: 12,\n  lg: 16,\n  xl: 20,\n  xxl: 24,\n  xxxl: 32,\n  huge: 40,\n} as const;\n\nexport const radii = {\n  sm: 10,\n  md: 16,\n  lg: 22,\n  xl: 28,\n  pill: 999,\n} as const;\n\nexport const typography = {\n  hero: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.8 },\n  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: -0.5 },\n  section: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },\n  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },\n  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' as const },\n  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },\n  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.35 },\n  button: { fontSize: 16, lineHeight: 20, fontWeight: '700' as const },\n  numeric: { fontSize: 46, lineHeight: 50, fontWeight: '800' as const, letterSpacing: -1.3 },\n} as const;\n\nexport const shadows = {\n  card: {\n    shadowOffset: { width: 0, height: 10 },\n    shadowOpacity: 0.12,\n    shadowRadius: 18,\n    elevation: 2,\n  },\n} as const;\n");
write('src/theme/useAppTheme.ts', "import { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { usePreferences } from '@/providers/PreferencesProvider';\nimport { colors, participantPalettes, radii, shadows, spacing, typography } from './tokens';\n\nexport function useAppTheme() {\n  const { myColor, partnerColor } = useWorkspace();\n  const { preferences } = usePreferences();\n  const me = participantPalettes[myColor];\n  const partner = participantPalettes[partnerColor];\n  const highContrast = preferences.high_contrast;\n\n  return {\n    scheme: 'dark' as const,\n    name: 'Dual Orbit' as const,\n    myColor,\n    partnerColor,\n    participantPalettes,\n    participants: { me, partner },\n    reducedMotion: preferences.reduced_motion,\n    haptics: preferences.haptics,\n    highContrast,\n    colors: {\n      ...colors.cosmic,\n      card: highContrast ? '#16131B' : colors.cosmic.card,\n      cardElevated: highContrast ? '#211C29' : colors.cosmic.cardElevated,\n      textSecondary: highContrast ? '#E6DFEC' : colors.cosmic.textSecondary,\n      textMuted: highContrast ? '#C1B7C9' : colors.cosmic.textMuted,\n      border: highContrast ? '#665B70' : colors.cosmic.border,\n\n      // Generic controls intentionally remain neutral.\n      accent: colors.cosmic.accent,\n      accentStrong: colors.cosmic.accentStrong,\n      accentSoft: colors.cosmic.accentSoft,\n      onAccent: colors.cosmic.onAccent,\n\n      // Explicit partner/person surfaces can still use these compatibility keys.\n      partnerAccent: partner.accent,\n      partnerAccentStrong: partner.accentStrong,\n      partnerAccentSoft: partner.accentSoft,\n      partnerOnAccent: partner.onAccent,\n\n      // Background identity hints stay deliberately subtle.\n      skyGlow: me.glowSoft,\n      skyGlowSoft: partner.glowSoft,\n    },\n    spacing,\n    radii,\n    shadows,\n    typography,\n  } as const;\n}\n\nexport type AppTheme = ReturnType<typeof useAppTheme>;\n");
write('src/providers/WorkspaceProvider.tsx', "import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';\nimport type { Couple, CoupleInvite, ParticipantColor, Profile } from '@/types/database';\nimport { useAuth } from './AuthProvider';\nimport { getWorkspace } from '@/services/backend/workspace';\nimport { realtimeClient } from '@/services/backend/realtime';\nimport { LEGACY_GREEN_COLOR, LEGACY_PURPLE_COLOR, normalizeParticipantColor, suggestDistinctParticipantColor } from '@/theme/tokens';\n\ntype WorkspaceContextValue = {\n  profile: Profile | null;\n  couple: Couple | null;\n  activeInvite: CoupleInvite | null;\n  memberCount: number;\n  partnerProfile: Profile | null;\n  myColor: ParticipantColor;\n  partnerColor: ParticipantColor;\n  colorForUser: (userId: string | null | undefined) => ParticipantColor | 'both';\n  isLoading: boolean;\n  error: string | null;\n  refresh: () => Promise<void>;\n};\n\nconst WorkspaceContext = createContext<WorkspaceContextValue | null>(null);\n\nexport function WorkspaceProvider({ children }: PropsWithChildren) {\n  const { user, isConfigured } = useAuth();\n  const [profile, setProfile] = useState<Profile | null>(null);\n  const [couple, setCouple] = useState<Couple | null>(null);\n  const [activeInvite, setActiveInvite] = useState<CoupleInvite | null>(null);\n  const [memberCount, setMemberCount] = useState(0);\n  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);\n  const [myColor, setMyColor] = useState<ParticipantColor>(LEGACY_PURPLE_COLOR);\n  const [partnerColor, setPartnerColor] = useState<ParticipantColor>(LEGACY_GREEN_COLOR);\n  const [isLoading, setIsLoading] = useState(Boolean(user && isConfigured));\n  const [error, setError] = useState<string | null>(null);\n  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);\n\n  const clearWorkspace = useCallback(() => {\n    setProfile(null);\n    setCouple(null);\n    setActiveInvite(null);\n    setMemberCount(0);\n    setPartnerProfile(null);\n    setMyColor(LEGACY_PURPLE_COLOR);\n    setPartnerColor(LEGACY_GREEN_COLOR);\n    setError(null);\n  }, []);\n\n  const refresh = useCallback(async () => {\n    if (!user || !isConfigured) {\n      clearWorkspace();\n      setLoadedUserId(null);\n      setIsLoading(false);\n      return;\n    }\n\n    setIsLoading(true);\n    setError(null);\n    try {\n      const snapshot = await getWorkspace();\n      setProfile(snapshot.profile);\n      setCouple(snapshot.couple);\n      setActiveInvite(snapshot.activeInvite);\n      setMemberCount(snapshot.memberCount);\n      setPartnerProfile(snapshot.partnerProfile);\n\n      const nextMyColor = normalizeParticipantColor(\n        snapshot.myColor ?? snapshot.profile.preferred_participant_color,\n        LEGACY_PURPLE_COLOR,\n      );\n      const fallbackPartner = suggestDistinctParticipantColor(nextMyColor);\n      setMyColor(nextMyColor);\n      setPartnerColor(normalizeParticipantColor(snapshot.partnerColor, fallbackPartner));\n    } catch (refreshError) {\n      const message = refreshError instanceof Error ? refreshError.message : 'Unable to reach the Togetherly backend.';\n      setError(message);\n      throw refreshError;\n    } finally {\n      setLoadedUserId(user.id);\n      setIsLoading(false);\n    }\n  }, [clearWorkspace, isConfigured, user]);\n\n  useEffect(() => {\n    refresh().catch((refreshError: unknown) => {\n      const message = refreshError instanceof Error ? refreshError.message : 'Unknown workspace error';\n      console.warn('Unable to load Togetherly workspace:', message);\n    });\n  }, [refresh]);\n\n  useEffect(() => {\n    if (!user || !couple?.id) return;\n    return realtimeClient.subscribe((event) => {\n      if (event.type === 'workspace.updated') refresh().catch(() => undefined);\n    });\n  }, [couple?.id, refresh, user]);\n\n  const workspaceIsLoading = isLoading || Boolean(user && loadedUserId !== user.id);\n\n  const colorForUser = useCallback((userId: string | null | undefined): ParticipantColor | 'both' => {\n    if (!userId || !profile?.id) return 'both';\n    if (userId === profile.id) return myColor;\n    if (partnerProfile && userId === partnerProfile.id) return partnerColor;\n    return 'both';\n  }, [myColor, partnerColor, partnerProfile, profile?.id]);\n\n  const value = useMemo<WorkspaceContextValue>(() => ({\n    profile,\n    couple,\n    activeInvite,\n    memberCount,\n    partnerProfile,\n    myColor,\n    partnerColor,\n    colorForUser,\n    isLoading: workspaceIsLoading,\n    error,\n    refresh,\n  }), [activeInvite, colorForUser, couple, error, memberCount, myColor, partnerColor, partnerProfile, profile, refresh, workspaceIsLoading]);\n\n  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;\n}\n\nexport function useWorkspace() {\n  const value = useContext(WorkspaceContext);\n  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider.');\n  return value;\n}\n");
write('src/components/common/Card.tsx', "import type { ReactNode } from 'react';\nimport { StyleSheet, View, type ViewStyle } from 'react-native';\nimport type { ParticipantColor } from '@/types/database';\nimport { participantPalettes } from '@/theme/tokens';\nimport { useAppTheme } from '@/theme/useAppTheme';\n\ntype Props = {\n  children: ReactNode;\n  style?: ViewStyle | ViewStyle[];\n  tone?: 'default' | 'accent' | 'secondary';\n  padded?: boolean;\n  participantColor?: ParticipantColor | 'both';\n};\n\nexport function Card({ children, style, tone = 'default', padded = true, participantColor }: Props) {\n  const theme = useAppTheme();\n  const backgroundColor = tone === 'accent' ? theme.colors.accentSoft : tone === 'secondary' ? theme.colors.secondarySoft : theme.colors.card;\n  const ownerPalette = participantColor && participantColor !== 'both' ? participantPalettes[participantColor] : null;\n\n  return (\n    <View\n      style={[\n        styles.card,\n        tone === 'accent' ? theme.shadows.card : null,\n        {\n          backgroundColor,\n          borderColor: theme.colors.border,\n          borderRadius: theme.radii.lg,\n          padding: padded ? theme.spacing.lg : 0,\n          shadowColor: theme.colors.shadow,\n        },\n        ownerPalette ? {\n          borderLeftWidth: 4,\n          borderLeftColor: ownerPalette.accent,\n        } : null,\n        participantColor === 'both' ? {\n          borderLeftWidth: 4,\n          borderLeftColor: theme.participants.me.accent,\n          borderRightWidth: 4,\n          borderRightColor: theme.participants.partner.accent,\n        } : null,\n        style,\n      ]}\n    >\n      {children}\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  card: { borderWidth: 1 },\n});\n");
write('src/components/common/TagChip.tsx', "import { View } from 'react-native';\nimport type { DrawingData, ParticipantColor } from '@/types/database';\nimport { participantPalettes } from '@/theme/tokens';\nimport { AppText } from './AppText';\nimport { DrawnIcon } from './DrawingCanvas';\nimport { useAppTheme } from '@/theme/useAppTheme';\n\nexport function TagChip({ label, subtle = false, participantColor, icon, iconDrawing }: { label: string; subtle?: boolean; participantColor?: ParticipantColor | 'both'; icon?: string | null; iconDrawing?: DrawingData | null }) {\n  const theme = useAppTheme();\n  const palette = participantColor && participantColor !== 'both' ? participantPalettes[participantColor] : null;\n  const both = participantColor === 'both';\n  const backgroundColor = palette?.tint ?? (subtle ? theme.colors.elevatedBackground : theme.colors.accentSoft);\n  const borderColor = palette?.border ?? (both ? theme.participants.me.border : theme.colors.border);\n  const textColor = palette?.accent ?? (both ? theme.colors.textPrimary : subtle ? theme.colors.textSecondary : theme.colors.accentStrong);\n\n  return (\n    <View\n      style={{\n        alignSelf: 'flex-start',\n        borderRadius: theme.radii.pill,\n        paddingHorizontal: 9,\n        paddingVertical: 5,\n        backgroundColor,\n        borderWidth: 1,\n        borderColor,\n        ...(both ? { borderRightColor: theme.participants.partner.border, borderRightWidth: 3 } : {}),\n      }}\n    >\n      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>\n        {iconDrawing?.strokes?.length ? <DrawnIcon strokes={iconDrawing.strokes} size={14} color={textColor} /> : icon ? <AppText variant=\"caption\" style={{ color: textColor }}>{icon}</AppText> : null}\n        <AppText variant=\"caption\" style={{ color: textColor }}>{label}</AppText>\n      </View>\n    </View>\n  );\n}\n");
write('src/components/common/Avatar.tsx', "import { Image, View } from 'react-native';\nimport type { ParticipantColor } from '@/types/database';\nimport { AppText } from './AppText';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { LEGACY_PURPLE_COLOR, participantPalettes } from '@/theme/tokens';\n\nexport function Avatar({ initials, imageUrl, size = 46, participantColor = LEGACY_PURPLE_COLOR }: { initials: string; imageUrl?: string | null; size?: number; participantColor?: ParticipantColor }) {\n  const palette = participantPalettes[participantColor];\n  const shell = { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.accentSoft, borderWidth: 2, borderColor: palette.accent } as const;\n  if (imageUrl) return <Image accessibilityLabel={`${initials} profile photo`} source={{ uri: imageUrl }} resizeMode=\"cover\" style={shell} />;\n  return <View accessibilityLabel={`${initials} avatar`} style={{ ...shell, alignItems: 'center', justifyContent: 'center' }}><AppText variant=\"cardTitle\" style={{ color: palette.accent }}>{initials}</AppText></View>;\n}\n\nfunction initial(value: string | undefined, fallback: string) { const trimmed = value?.trim(); return trimmed ? trimmed.slice(0, 1).toUpperCase() : fallback; }\n\nexport function CoupleAvatar() {\n  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();\n  return <View style={{ width: 72, height: 48, flexDirection: 'row', alignItems: 'center' }}>\n    <Avatar initials={initial(profile?.display_name, '?')} imageUrl={profile?.avatar_url} size={48} participantColor={myColor} />\n    <View style={{ marginLeft: -18 }}><Avatar initials={initial(partnerProfile?.display_name, '\u2661')} imageUrl={partnerProfile?.avatar_url} size={48} participantColor={partnerColor} /></View>\n  </View>;\n}\n");
write('src/components/common/ParticipantAttribution.tsx', "import { View } from 'react-native';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { participantPalettes } from '@/theme/tokens';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { AppText } from './AppText';\n\nfunction initial(name: string) { return name.trim().slice(0, 1).toUpperCase() || '\u2022'; }\n\nexport function ParticipantAttribution({ userId, verb = 'Added by', suffix }: { userId: string | null | undefined; verb?: string; suffix?: string }) {\n  const theme = useAppTheme();\n  const { profile, partnerProfile, colorForUser } = useWorkspace();\n  const color = colorForUser(userId);\n  const palette = color === 'both' ? null : participantPalettes[color];\n  const accent = palette?.accent ?? theme.colors.textMuted;\n  const name = profile && userId === profile.id\n    ? profile.display_name\n    : partnerProfile && userId === partnerProfile.id\n      ? partnerProfile.display_name\n      : 'Previous member';\n  const isMe = Boolean(profile && userId === profile.id);\n\n  return (\n    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>\n      <View style={{\n        width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',\n        borderWidth: 1, borderColor: palette?.border ?? theme.colors.border,\n        backgroundColor: palette?.tint ?? theme.colors.elevatedBackground,\n      }}>\n        <AppText variant=\"caption\" style={{ color: accent, fontSize: 9, lineHeight: 11 }}>{initial(name)}</AppText>\n      </View>\n      <AppText variant=\"caption\" style={{ color: accent }}>\n        {verb} {name}{isMe ? ' \u00b7 YOU' : ''}{suffix ? ` \u00b7 ${suffix}` : ''}\n      </AppText>\n    </View>\n  );\n}\n");
write('src/components/art/TogetherlyArt.tsx', "import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';\nimport { useAppTheme } from '@/theme/useAppTheme';\n\nexport function TogetherlyMark({ size = 76 }: { size?: number }) {\n  const theme = useAppTheme();\n  const me = theme.participants.me;\n  const partner = theme.participants.partner;\n  return (\n    <Svg width={size} height={size} viewBox=\"0 0 80 80\">\n      <Defs><LinearGradient id=\"mark\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><Stop offset=\"0\" stopColor={me.accent}/><Stop offset=\"1\" stopColor={partner.accent}/></LinearGradient></Defs>\n      <Circle cx=\"40\" cy=\"40\" r=\"31\" fill=\"rgba(255,255,255,0.025)\" stroke=\"url(#mark)\" strokeWidth=\"1.5\"/>\n      <Ellipse cx=\"40\" cy=\"40\" rx=\"26\" ry=\"12\" fill=\"none\" stroke={me.accent} strokeOpacity=\"0.62\" strokeWidth=\"1.4\" transform=\"rotate(-28 40 40)\"/>\n      <Ellipse cx=\"40\" cy=\"40\" rx=\"26\" ry=\"12\" fill=\"none\" stroke={partner.accent} strokeOpacity=\"0.55\" strokeWidth=\"1.4\" transform=\"rotate(28 40 40)\"/>\n      <Circle cx=\"20\" cy=\"32\" r=\"4.6\" fill={me.accent}/><Circle cx=\"60\" cy=\"48\" r=\"4.6\" fill={partner.accent}/>\n      <Path d=\"M40 50s-9-5.1-9-11.2a4.7 4.7 0 0 1 8.1-3.2l.9 1 .9-1a4.7 4.7 0 0 1 8.1 3.2C49 44.9 40 50 40 50Z\" fill=\"url(#mark)\"/>\n      <Circle cx=\"57\" cy=\"20\" r=\"1.8\" fill={theme.colors.star}/><Circle cx=\"26\" cy=\"59\" r=\"1.3\" fill={theme.colors.star}/>\n    </Svg>\n  );\n}\n\nexport function ConnectionOrbitArt({ width = 260, height = 126 }: { width?: number; height?: number }) {\n  const theme = useAppTheme();\n  const me = theme.participants.me;\n  const partner = theme.participants.partner;\n  return (\n    <Svg width={width} height={height} viewBox=\"0 0 260 126\">\n      <Defs><LinearGradient id=\"bridge\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><Stop offset=\"0\" stopColor={me.accent}/><Stop offset=\"1\" stopColor={partner.accent}/></LinearGradient></Defs>\n      <Path d=\"M38 80C74 20 184 20 222 80\" fill=\"none\" stroke=\"url(#bridge)\" strokeOpacity=\"0.34\" strokeWidth=\"1.5\" strokeDasharray=\"4 7\"/>\n      <Path d=\"M38 80C83 108 178 108 222 80\" fill=\"none\" stroke=\"url(#bridge)\" strokeOpacity=\"0.5\" strokeWidth=\"1.5\"/>\n      <Circle cx=\"38\" cy=\"80\" r=\"17\" fill={me.accentSoft} stroke={me.accent} strokeWidth=\"1.5\"/>\n      <Circle cx=\"222\" cy=\"80\" r=\"17\" fill={partner.accentSoft} stroke={partner.accent} strokeWidth=\"1.5\"/>\n      <Circle cx=\"38\" cy=\"80\" r=\"5\" fill={me.accent}/><Circle cx=\"222\" cy=\"80\" r=\"5\" fill={partner.accent}/>\n      <Path d=\"M130 72s-12-6.9-12-15.2a6.1 6.1 0 0 1 10.5-4.2l1.5 1.7 1.5-1.7a6.1 6.1 0 0 1 10.5 4.2C142 65.1 130 72 130 72Z\" fill=\"url(#bridge)\"/>\n      <G fill={theme.colors.star}><Circle cx=\"82\" cy=\"40\" r=\"1.6\"/><Circle cx=\"177\" cy=\"30\" r=\"1.2\"/><Circle cx=\"151\" cy=\"101\" r=\"1.5\"/><Circle cx=\"103\" cy=\"94\" r=\"1\"/></G>\n    </Svg>\n  );\n}\n\nexport function MemoryConstellationArt({ width = 150, height = 76 }: { width?: number; height?: number }) {\n  const theme = useAppTheme();\n  const me = theme.participants.me;\n  const partner = theme.participants.partner;\n  return (\n    <Svg width={width} height={height} viewBox=\"0 0 150 76\">\n      <Path d=\"M15 53 43 29 77 46 108 20 135 40\" fill=\"none\" stroke={theme.colors.border} strokeWidth=\"1.2\" strokeDasharray=\"3 5\"/>\n      <Circle cx=\"15\" cy=\"53\" r=\"4\" fill={me.accent}/><Circle cx=\"43\" cy=\"29\" r=\"3\" fill={theme.colors.star}/><Circle cx=\"77\" cy=\"46\" r=\"5\" fill={partner.accent}/><Circle cx=\"108\" cy=\"20\" r=\"3\" fill={theme.colors.star}/><Circle cx=\"135\" cy=\"40\" r=\"4\" fill={me.accent}/>\n      <Path d=\"M74 24s-7-3.8-7-8.7a3.6 3.6 0 0 1 6.1-2.5l.9 1 .9-1a3.6 3.6 0 0 1 6.1 2.5c0 4.9-7 8.7-7 8.7Z\" fill={partner.accent} opacity=\"0.85\"/>\n    </Svg>\n  );\n}\n");
write('src/components/common/ParticipantColorPicker.tsx', "import { useEffect, useState } from 'react';\nimport { Pressable, View } from 'react-native';\nimport type { ParticipantColor } from '@/types/database';\nimport {\n  normalizeParticipantColor,\n  participantColorPresets,\n  participantColorsTooClose,\n  participantPalettes,\n} from '@/theme/tokens';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { AppText } from './AppText';\nimport { FormField } from './FormField';\n\nexport function ParticipantColorPicker({\n  value,\n  onChange,\n  partnerColor,\n  label = 'YOUR COLOUR',\n}: {\n  value: ParticipantColor;\n  onChange: (value: ParticipantColor) => void;\n  partnerColor?: ParticipantColor | null;\n  label?: string;\n}) {\n  const theme = useAppTheme();\n  const normalized = normalizeParticipantColor(value);\n  const [custom, setCustom] = useState(normalized);\n  useEffect(() => { setCustom(normalized); }, [normalized]);\n\n  const tooClose = Boolean(partnerColor && participantColorsTooClose(normalized, partnerColor));\n\n  function changeCustom(next: string) {\n    const cleaned = next.trim().toUpperCase();\n    setCustom(cleaned);\n    if (/^#[0-9A-F]{6}$/.test(cleaned)) onChange(cleaned);\n  }\n\n  return (\n    <View style={{ gap: theme.spacing.sm }}>\n      <AppText variant=\"caption\" tone=\"secondary\">{label}</AppText>\n      <AppText variant=\"bodySmall\" tone=\"secondary\">\n        This colour identifies you \u2014 Togetherly controls stay neutral.\n      </AppText>\n\n      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>\n        {participantColorPresets.map((option) => {\n          const selected = normalized === option.value;\n          const palette = participantPalettes[option.value];\n          const conflicts = Boolean(partnerColor && participantColorsTooClose(option.value, partnerColor));\n          return (\n            <Pressable\n              key={option.value}\n              accessibilityRole=\"button\"\n              accessibilityLabel={`${option.label}${selected ? ', selected' : ''}${conflicts ? ', similar to partner colour' : ''}`}\n              accessibilityState={{ selected }}\n              onPress={() => onChange(option.value)}\n              style={({ pressed }) => ({\n                width: 42,\n                height: 42,\n                borderRadius: 21,\n                backgroundColor: palette.accent,\n                borderWidth: selected ? 3 : 1,\n                borderColor: selected ? theme.colors.textPrimary : conflicts ? theme.colors.warning : palette.border,\n                opacity: pressed ? 0.7 : conflicts ? 0.68 : 1,\n                transform: [{ scale: selected ? 1.07 : 1 }],\n              })}\n            />\n          );\n        })}\n      </View>\n\n      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.md }}>\n        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: participantPalettes[normalized].accent, borderWidth: 2, borderColor: participantPalettes[normalized].border }} />\n        <View style={{ flex: 1 }}>\n          <FormField\n            label=\"CUSTOM \u00b7 #RRGGBB\"\n            value={custom}\n            onChangeText={changeCustom}\n            autoCapitalize=\"characters\"\n            autoCorrect={false}\n            maxLength={7}\n            placeholder=\"#78A9FF\"\n          />\n        </View>\n      </View>\n\n      {tooClose ? (\n        <AppText variant=\"bodySmall\" tone=\"warning\">\n          Choose something more distinct from your partner so you can recognise each other instantly.\n        </AppText>\n      ) : null}\n    </View>\n  );\n}\n");
write('src/app/features/themes.tsx', "import { useEffect, useState } from 'react';\nimport { Alert, Pressable, View } from 'react-native';\nimport { AppScreen } from '@/components/common/AppScreen';\nimport { BackHeader } from '@/components/common/BackHeader';\nimport { Card } from '@/components/common/Card';\nimport { AppText } from '@/components/common/AppText';\nimport { AppButton } from '@/components/common/AppButton';\nimport { TagChip } from '@/components/common/TagChip';\nimport { Avatar } from '@/components/common/Avatar';\nimport { ParticipantColorPicker } from '@/components/common/ParticipantColorPicker';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { usePreferences } from '@/providers/PreferencesProvider';\nimport { participantColorsTooClose, participantPalettes } from '@/theme/tokens';\nimport { updateProfile } from '@/services/backend/workspace';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport type { ParticipantColor, UserPreferences } from '@/types/database';\n\nconst themes: { value: UserPreferences['backdrop_theme']; title: string; subtitle: string }[] = [\n  { value: 'dual_orbit', title: 'Dual Orbit', subtitle: 'Cosmic night with both of your colours in orbit.' },\n  { value: 'minimal_night', title: 'Minimal Night', subtitle: 'Dark, quiet and nearly decoration-free.' },\n  { value: 'cottagecore', title: 'Cottage Night', subtitle: 'Botanical details over a softer night sky.' },\n  { value: 'gothic', title: 'Gothic Sky', subtitle: 'Darker atmosphere and stronger star contrast.' },\n  { value: 'warm_light', title: 'Warm Night', subtitle: 'A soft amber glow over the night backdrop.' },\n];\n\nfunction messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }\nfunction initial(value: string | undefined) { return value?.trim().slice(0, 1).toUpperCase() || '\u2661'; }\n\nexport default function ThemesScreen() {\n  const theme = useAppTheme();\n  const { profile, partnerProfile, myColor, partnerColor, refresh } = useWorkspace();\n  const { preferences, save } = usePreferences();\n  const [draftColor, setDraftColor] = useState<ParticipantColor>(myColor);\n  const [busy, setBusy] = useState(false);\n\n  useEffect(() => { setDraftColor(myColor); }, [myColor]);\n\n  async function choose(backdropTheme: UserPreferences['backdrop_theme']) {\n    try { await save({ backdropTheme }); }\n    catch (error) { Alert.alert('Couldn\u2019t save theme', messageFrom(error)); }\n  }\n\n  async function saveIdentityColor() {\n    if (partnerProfile && participantColorsTooClose(draftColor, partnerColor)) {\n      Alert.alert('Choose a more distinct colour', 'Your two identity colours need to be easy to tell apart at a glance.');\n      return;\n    }\n    setBusy(true);\n    try {\n      await updateProfile({ preferredColor: draftColor });\n      await refresh();\n    } catch (error) { Alert.alert('Couldn\u2019t change your colour', messageFrom(error)); }\n    finally { setBusy(false); }\n  }\n\n  const myPalette = participantPalettes[myColor];\n  const partnerPalette = participantPalettes[partnerColor];\n\n  return (\n    <AppScreen>\n      <BackHeader eyebrow=\"Settings\" title=\"Identity & appearance\" subtitle=\"Your colours identify people. Togetherly itself stays neutral.\" />\n\n      <Card participantColor=\"both\" style={{ gap: theme.spacing.lg, overflow: 'hidden', marginBottom: theme.spacing.xxl }}>\n        <AppText variant=\"caption\" tone=\"secondary\">YOUR SHARED SIGNATURE</AppText>\n        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>\n          <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>\n            <Avatar initials={initial(profile?.display_name)} imageUrl={profile?.avatar_url} size={54} participantColor={myColor} />\n            <AppText variant=\"cardTitle\" style={{ color: myPalette.accent }}>{profile?.display_name ?? 'You'}</AppText>\n            <TagChip participantColor={myColor} label=\"YOU\" />\n          </View>\n          <View style={{ flex: 1, alignItems: 'center', gap: 7 }}>\n            <Avatar initials={initial(partnerProfile?.display_name)} imageUrl={partnerProfile?.avatar_url} size={54} participantColor={partnerColor} />\n            <AppText variant=\"cardTitle\" style={{ color: partnerPalette.accent }}>{partnerProfile?.display_name ?? 'Partner'}</AppText>\n            <TagChip participantColor={partnerColor} label={partnerProfile ? 'PARTNER' : 'WAITING'} />\n          </View>\n        </View>\n        <AppText variant=\"bodySmall\" tone=\"secondary\" align=\"center\">\n          Your colour marks your avatar, ownership, assignment, drawing strokes and player identity. Both colours together mean \u201cus\u201d.\n        </AppText>\n      </Card>\n\n      <Card style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>\n        <AppText variant=\"section\">My identity colour</AppText>\n        <ParticipantColorPicker value={draftColor} onChange={setDraftColor} partnerColor={partnerProfile ? partnerColor : undefined} />\n        <AppButton label={busy ? 'Saving\u2026' : 'Save my colour'} disabled={busy || draftColor === myColor} onPress={saveIdentityColor} />\n      </Card>\n\n      <View style={{ gap: theme.spacing.md }}>\n        <AppText variant=\"section\">Backdrop</AppText>\n        {themes.map((option) => {\n          const active = preferences.backdrop_theme === option.value;\n          return (\n            <Pressable accessibilityRole=\"button\" key={option.value} onPress={() => choose(option.value)}>\n              {({ pressed }) => (\n                <Card tone={active ? 'accent' : 'default'} style={{ gap: 5, opacity: pressed ? 0.72 : 1 }}>\n                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>\n                    <View style={{ flex: 1 }}>\n                      <AppText variant=\"cardTitle\">{option.title}</AppText>\n                      <AppText variant=\"bodySmall\" tone=\"secondary\">{option.subtitle}</AppText>\n                    </View>\n                    {active ? <TagChip label=\"ACTIVE\" /> : null}\n                  </View>\n                </Card>\n              )}\n            </Pressable>\n          );\n        })}\n      </View>\n    </AppScreen>\n  );\n}\n");
write('src/services/backend/workspace.ts', "import type { ParticipantColor, Profile, WorkspaceSnapshot } from '@/types/database';\nimport { apiRequest } from './api';\n\nexport function getWorkspace() { return apiRequest<WorkspaceSnapshot>('/workspace'); }\n\nexport async function createCoupleWorkspace(input: { relationshipStartDate?: string | null; longDistanceEnabled: boolean; participantColor?: ParticipantColor }) {\n  return apiRequest<{ coupleId: string; inviteCode: string; participantColor: ParticipantColor }>('/workspace/create', { method: 'POST', body: input });\n}\n\nexport async function joinCoupleWithCode(inviteCode: string, participantColor?: ParticipantColor) {\n  const normalizedCode = inviteCode.trim().toUpperCase();\n  if (!normalizedCode) throw new Error('Enter an invite code first.');\n  return apiRequest<{ coupleId: string; participantColor: ParticipantColor }>('/workspace/join', { method: 'POST', body: { inviteCode: normalizedCode, participantColor } });\n}\n\nexport async function regenerateCoupleInvite() { return apiRequest<{ inviteCode: string }>('/workspace/invite/regenerate', { method: 'POST', body: {} }); }\n\nexport async function updateProfile(input: { displayName?: string; timezone?: string; timezoneMode?: 'automatic' | 'manual'; avatarUrl?: string | null; preferredColor?: ParticipantColor; onboardingComplete?: boolean }) {\n  return apiRequest<{ profile: Profile }>('/workspace/profile', { method: 'PATCH', body: input });\n}\n\nexport async function updateCouple(input: { relationshipStartDate?: string | null; longDistanceEnabled?: boolean }) {\n  return apiRequest<{ couple: import('@/types/database').Couple }>('/workspace/couple', { method: 'PATCH', body: input });\n}\n\nexport function leaveCouple() { return apiRequest<{ ok: true }>('/workspace/leave', { method: 'POST' }); }\nexport function removePartner() { return apiRequest<{ ok: true }>('/workspace/remove-partner', { method: 'POST' }); }\nexport function deleteCoupleSpace() { return apiRequest<void>('/workspace', { method: 'DELETE' }); }\n");
write('server/migrations/013_custom_participant_colors.sql', "-- Togetherly Release A: custom participant identity colours.\n-- Existing Purple/Green couples keep the same visual colours, now stored as hex.\n\nALTER TABLE couple_members DROP CONSTRAINT IF EXISTS couple_members_participant_color_check;\nALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_participant_color_check;\n\nUPDATE couple_members\nSET participant_color = CASE lower(participant_color)\n  WHEN 'purple' THEN '#BE9AFF'\n  WHEN 'green' THEN '#B7CB7C'\n  ELSE upper(participant_color)\nEND\nWHERE participant_color IS NOT NULL;\n\nUPDATE users\nSET preferred_participant_color = CASE lower(preferred_participant_color)\n  WHEN 'purple' THEN '#BE9AFF'\n  WHEN 'green' THEN '#B7CB7C'\n  ELSE upper(preferred_participant_color)\nEND\nWHERE preferred_participant_color IS NOT NULL;\n\nALTER TABLE couple_members ADD CONSTRAINT couple_members_participant_color_check\n  CHECK (participant_color IS NULL OR participant_color ~ '^#[0-9A-F]{6}$');\n\nALTER TABLE users ADD CONSTRAINT users_preferred_participant_color_check\n  CHECK (preferred_participant_color IS NULL OR preferred_participant_color ~ '^#[0-9A-F]{6}$');\n");

// ParticipantColor becomes a canonical #RRGGBB string. The backend validates it.
{
  const rel = 'src/types/database.ts';
  let text = read(rel);
  text = text.replace("export type ParticipantColor = 'purple' | 'green';", "export type ParticipantColor = string;");
  // A small number of game helper props used the old literal union directly.
  text = text.replace(/'purple'\s*\|\s*'green'/g, 'string');
  write(rel, text);
}

// Onboarding: creator and joining partner each choose their own identity colour.
{
  const rel = 'src/app/(onboarding)/index.tsx';
  let text = read(rel);

  if (!text.includes("ParticipantColorPicker")) {
    text = text.replace(
      "import { PhotoPickerField } from '@/components/common/PhotoPickerField';",
      "import { PhotoPickerField } from '@/components/common/PhotoPickerField';\nimport { ParticipantColorPicker } from '@/components/common/ParticipantColorPicker';"
    );
  }
  text = text.replace(
    "import { participantPalettes } from '@/theme/tokens';",
    "import { LEGACY_PURPLE_COLOR, normalizeParticipantColor, participantPalettes } from '@/theme/tokens';"
  );
  text = text.replace(
    "const [chosenColor, setChosenColor] = useState<ParticipantColor>('purple');",
    "const [chosenColor, setChosenColor] = useState<ParticipantColor>(LEGACY_PURPLE_COLOR);"
  );
  if (!text.includes("setChosenColor(normalizeParticipantColor(profile.preferred_participant_color")) {
    text = text.replace(
      "    setPhoto(profile.avatar_url);\n    setChosenColor(profile.preferred_participant_color ?? myColor ?? 'purple');",
      "    setPhoto(profile.avatar_url);\n    setChosenColor(normalizeParticipantColor(profile.preferred_participant_color ?? myColor, LEGACY_PURPLE_COLOR));"
    );
    // Older exact source did not yet set chosenColor in this effect.
    text = text.replace(
      "    setPhoto(profile.avatar_url);\n    if (couple) {",
      "    setPhoto(profile.avatar_url);\n    setChosenColor(normalizeParticipantColor(profile.preferred_participant_color ?? myColor, LEGACY_PURPLE_COLOR));\n    if (couple) {"
    );
  }
  text = text.replace("await joinCoupleWithCode(inviteCode);", "await joinCoupleWithCode(inviteCode, chosenColor);");
  text = text.replace("Your colour marks what you add. Your partner gets the other one.", "Your colour marks what you add. Your partner chooses their own colour.");

  const oldPicker = `<View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" tone="secondary">CHOOSE YOUR COLOUR</AppText>
              <AppText variant="bodySmall" tone="secondary">Your colour marks what you add. Your partner chooses their own colour.</AppText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                {(['purple', 'green'] as const).map((color) => {
                  const palette = participantPalettes[color]; const active = chosenColor === color;
                  return <Pressable key={color} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setChosenColor(color)} style={{ flex: 1 }}><Card participantColor={color} style={{ gap: 8, borderWidth: active ? 2 : 1, borderColor: active ? palette.accent : theme.colors.border }}><View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.accent }} /><AppText variant="cardTitle" style={{ color: palette.accent }}>{palette.label}</AppText><AppText variant="caption" tone="muted">{active ? 'Selected' : 'Choose'}</AppText></Card></Pressable>;
                })}
              </View>
            </View>`;

  if (text.includes(oldPicker)) {
    text = text.replace(oldPicker, `<ParticipantColorPicker value={chosenColor} onChange={setChosenColor} label="CHOOSE YOUR COLOUR" />`);
  } else if (!text.includes('<ParticipantColorPicker value={chosenColor} onChange={setChosenColor} label="CHOOSE YOUR COLOUR" />')) {
    // Match the original Purple/Green selector regardless of minor whitespace.
    text = text.replace(
      /<View style=\{\{ gap: theme\.spacing\.sm \}\}>\s*<AppText variant="caption" tone="secondary">CHOOSE YOUR COLOUR<\/AppText>[\s\S]*?\{\(\['purple', 'green'\] as const\)\.map\(\(color\) => \{[\s\S]*?<\/View>\s*<\/View>/,
      '<ParticipantColorPicker value={chosenColor} onChange={setChosenColor} label="CHOOSE YOUR COLOUR" />'
    );
  }

  if (!text.includes('label="YOUR COLOUR BEFORE JOINING"')) {
    text = text.replace(
      `<AppText variant="bodySmall" tone="secondary">Enter your partner’s 8-character code. You’ll use the other colour.</AppText>`,
      `<AppText variant="bodySmall" tone="secondary">Enter your partner’s 8-character code, then choose the colour that will identify you.</AppText>\n            <ParticipantColorPicker value={chosenColor} onChange={setChosenColor} label="YOUR COLOUR BEFORE JOINING" />`
    );
  }

  write(rel, text);
}

// Tags had one hard-coded purple/green ownership branch.
{
  const rel = 'src/app/features/tags.tsx';
  let text = read(rel);
  text = text.replace(
    "borderLeftColor: colorForUser(tag.creator_id) === 'purple' ? theme.participantPalettes.purple.accent : colorForUser(tag.creator_id) === 'green' ? theme.participantPalettes.green.accent : theme.colors.textMuted",
    "borderLeftColor: colorForUser(tag.creator_id) === 'both' ? theme.colors.textMuted : theme.participantPalettes[colorForUser(tag.creator_id)].accent"
  );
  write(rel, text);
}

// Couple hero: the relationship signature now comes from the actual two chosen colours.
{
  const rel = 'src/components/dashboard/CoupleHero.tsx';
  let text = read(rel);
  text = text.replace("participantPalettes.purple.glow", "participantPalettes[myColor].glow");
  text = text.replace("participantPalettes.green.glow", "participantPalettes[partnerColor].glow");
  write(rel, text);
}

// Any old direct literal-union annotations in feature code are widened so custom hex values pass through.
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}
for (const absolute of walk(file('src'))) {
  let text = fs.readFileSync(absolute, 'utf8');
  const next = text.replace(/'purple'\s*\|\s*'green'/g, 'string');
  if (next !== text) {
    fs.writeFileSync(absolute, next, 'utf8');
    console.log(`Widened old colour type in ${path.relative(project, absolute)}`);
  }
}

// Backend workspace accepts #RRGGBB colours and makes each member choose a distinct identity colour.
{
  const rel = 'server/src/routes/workspace.ts';
  let text = read(rel);

  text = text.replace(
    "import { dateOnlyOrNull, imageDataOrUrl, isValidTimezone, oneOf } from './helpers.js';",
    "import { dateOnlyOrNull, imageDataOrUrl, isValidTimezone } from './helpers.js';"
  );

  const oldTop = `type ParticipantColor = 'purple' | 'green';
const opposite = (color: ParticipantColor): ParticipantColor => color === 'purple' ? 'green' : 'purple';`;
  const newTop = `type ParticipantColor = string;
const LEGACY_PURPLE = '#BE9AFF';
const LEGACY_GREEN = '#B7CB7C';
const COLOR_RE = /^#[0-9A-F]{6}$/;
const COLOR_DISTANCE_MIN = 72;
const colorPresets = ['#BE9AFF','#78A9FF','#74C7EC','#6FD3E8','#69D1BE','#77D69C','#B7CB7C','#E7B76A','#F39A6B','#F08383','#F08FB1','#E79AE8'];

function normalizeColor(value: unknown, fallback: ParticipantColor): ParticipantColor {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'PURPLE') return LEGACY_PURPLE;
  if (normalized === 'GREEN') return LEGACY_GREEN;
  return COLOR_RE.test(normalized) ? normalized : fallback;
}
function requiredColor(value: unknown): ParticipantColor {
  if (typeof value !== 'string') throw new ApiError(400, 'Choose a valid identity colour.');
  const normalized = value.trim().toUpperCase();
  if (normalized === 'PURPLE') return LEGACY_PURPLE;
  if (normalized === 'GREEN') return LEGACY_GREEN;
  if (!COLOR_RE.test(normalized)) throw new ApiError(400, 'Identity colour must use #RRGGBB format.');
  return normalized;
}
function colorRgb(value: ParticipantColor) {
  const color = normalizeColor(value, LEGACY_PURPLE);
  return [parseInt(color.slice(1,3),16), parseInt(color.slice(3,5),16), parseInt(color.slice(5,7),16)] as const;
}
function colorsTooClose(left: ParticipantColor, right: ParticipantColor) {
  const a = colorRgb(left), b = colorRgb(right);
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2) < COLOR_DISTANCE_MIN;
}
function distinctFallback(taken: ParticipantColor) {
  return colorPresets.find((candidate) => !colorsTooClose(candidate, taken)) ?? LEGACY_GREEN;
}`;
  if (text.includes(oldTop)) text = text.replace(oldTop, newTop);

  text = text.replace(
    `      const myColor: ParticipantColor = currentRow?.participant_color === 'green' ? 'green' : 'purple';
      const partnerColor: ParticipantColor = partnerRow?.participant_color === 'purple' ? 'purple' : partnerRow?.participant_color === 'green' ? 'green' : opposite(myColor);`,
    `      const myColor: ParticipantColor = normalizeColor(currentRow?.participant_color, LEGACY_PURPLE);
      const partnerColor: ParticipantColor = normalizeColor(partnerRow?.participant_color, distinctFallback(myColor));`
  );

  text = text.replace(
    `      const requested = oneOf(body.participantColor, ['purple', 'green'] as const,
        profile.rows[0].preferred_participant_color === 'green' ? 'green' : 'purple');`,
    `      const fallback = normalizeColor(profile.rows[0].preferred_participant_color, LEGACY_PURPLE);
      const requested = body.participantColor === undefined ? fallback : requiredColor(body.participantColor);`
  );

  text = text.replace(
    `      const taken: ParticipantColor = members.rows[0]?.participant_color === 'green' ? 'green' : 'purple';
      const assigned = opposite(taken);`,
    `      const taken: ParticipantColor = normalizeColor(members.rows[0]?.participant_color, LEGACY_PURPLE);
      const assigned = body.participantColor === undefined ? distinctFallback(taken) : requiredColor(body.participantColor);
      if (colorsTooClose(assigned, taken)) throw new ApiError(409, 'Choose a colour that is more distinct from your partner’s colour.');`
  );

  const oldPreferred = `      const preferredColor = body.preferredColor === undefined
        ? (current.preferred_participant_color === 'green' ? 'green' : current.preferred_participant_color === 'purple' ? 'purple' : null)
        : oneOf(body.preferredColor, ['purple', 'green'] as const, 'purple');`;
  const newPreferred = `      const preferredColor = body.preferredColor === undefined
        ? (current.preferred_participant_color ? normalizeColor(current.preferred_participant_color, LEGACY_PURPLE) : null)
        : requiredColor(body.preferredColor);`;
  if (text.includes(oldPreferred)) text = text.replace(oldPreferred, newPreferred);

  const oldMembership = `      const membership = await client.query('SELECT couple_id,participant_color FROM couple_members WHERE user_id=$1 FOR UPDATE', [request.userId]);
      if (membership.rows[0] && preferredColor && preferredColor !== membership.rows[0].participant_color) {
        const count = await client.query('SELECT count(*)::int AS count FROM couple_members WHERE couple_id=$1', [membership.rows[0].couple_id]);
        if (Number(count.rows[0]?.count ?? 0) > 1) throw new ApiError(409, 'Both colours are already in use. Use “Swap our colours” to change them together.');
        await client.query('UPDATE couple_members SET participant_color=$1 WHERE user_id=$2', [preferredColor, request.userId]);
      }`;
  const newMembership = `      const membership = await client.query('SELECT couple_id,participant_color FROM couple_members WHERE user_id=$1 FOR UPDATE', [request.userId]);
      if (membership.rows[0] && preferredColor && preferredColor !== normalizeColor(membership.rows[0].participant_color, LEGACY_PURPLE)) {
        const partnerColorResult = await client.query('SELECT participant_color FROM couple_members WHERE couple_id=$1 AND user_id<>$2 LIMIT 1', [membership.rows[0].couple_id, request.userId]);
        const partnerColor = partnerColorResult.rows[0]?.participant_color ? normalizeColor(partnerColorResult.rows[0].participant_color, distinctFallback(preferredColor)) : null;
        if (partnerColor && colorsTooClose(preferredColor, partnerColor)) throw new ApiError(409, 'Choose a colour that is more distinct from your partner’s colour.');
        await client.query('UPDATE couple_members SET participant_color=$1 WHERE user_id=$2', [preferredColor, request.userId]);
      }`;
  if (text.includes(oldMembership)) text = text.replace(oldMembership, newMembership);

  write(rel, text);
}

// Swap endpoint remains valid for arbitrary colours; only legacy null fallbacks needed changing.
{
  const rel = 'server/src/routes/preferences.ts';
  let text = read(rel);
  text = text.replace("const firstNext = second.participant_color ?? 'green';", "const firstNext = second.participant_color ?? '#B7CB7C';");
  text = text.replace("const secondNext = first.participant_color ?? 'purple';", "const secondNext = first.participant_color ?? '#BE9AFF';");
  write(rel, text);
}

// Previously discussed false shared-note conflict is included so Release A starts from a stable base.
{
  const rel = 'server/src/routes/coreFeatures.ts';
  let text = read(rel);
  const oldSql = `         WHERE id = $5 AND couple_id = $6 AND ($7::timestamptz IS NULL OR updated_at = $7::timestamptz) RETURNING *`;
  const newSql = `         WHERE id = $5 AND couple_id = $6
           AND ($7::timestamptz IS NULL OR date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $7::timestamptz))
         RETURNING *`;
  if (text.includes(oldSql)) {
    text = text.replace(oldSql, newSql);
    write(rel, text);
  } else {
    console.log('Shared-note timestamp hotfix already present or source changed.');
  }
}

// Native Watch and widgets: decode the stored #RRGGBB identity instead of assuming Purple/Green.
function patchSwift(rel, kind) {
  let text = read(rel);
  const oldConstants = `private let purple = Color(red: 0.61, green: 0.42, blue: 0.96)
private let green = Color(red: 0.55, green: 0.72, blue: 0.45)`;
  if (text.includes(oldConstants)) text = text.replace(oldConstants, "private let neutralAccent = Color(red: 0.87, green: 0.84, blue: 0.90)\n\nprivate func identityColor(_ raw: String) -> Color {\n    let legacy: String\n    switch raw.lowercased() {\n    case \"purple\": legacy = \"#BE9AFF\"\n    case \"green\": legacy = \"#B7CB7C\"\n    default: legacy = raw\n    }\n    let value = legacy.trimmingCharacters(in: CharacterSet(charactersIn: \"#\"))\n    guard value.count == 6, let number = Int(value, radix: 16) else { return neutralAccent }\n    return Color(\n        red: Double((number >> 16) & 0xFF) / 255.0,\n        green: Double((number >> 8) & 0xFF) / 255.0,\n        blue: Double(number & 0xFF) / 255.0\n    )\n}\n".trim());

  text = text.replace(/state\.partner\.color == "green" \? green : purple/g, 'identityColor(state.partner.color)');
  text = text.replace(/\.tint\(purple\)/g, '.tint(neutralAccent)');
  text = text.replace(/\.foregroundStyle\(purple\)/g, '.foregroundStyle(neutralAccent)');
  text = text.replace(/\.foregroundStyle\(green\)/g, '.foregroundStyle(neutralAccent)');

  if (kind === 'watch-home') {
    text = text.replace(
      'Circle().stroke(purple.opacity(0.35), lineWidth: 1).frame(width: 70, height: 70)',
      'Circle().stroke(identityColor(state.me.color).opacity(0.35), lineWidth: 1).frame(width: 70, height: 70)'
    );
    text = text.replace(
      'Circle().stroke(green.opacity(0.25), lineWidth: 1).frame(width: 54, height: 54)',
      'Circle().stroke(identityColor(state.partner.color).opacity(0.28), lineWidth: 1).frame(width: 54, height: 54)'
    );
  }

  write(rel, text);
}
patchSwift('targets/TogetherlyWatch/TogetherlyWatchHome.swift', 'watch-home');
patchSwift('targets/TogetherlyWatchWidget/TogetherlyWatchWidget.swift', 'widget');
patchSwift('targets/TogetherlyWidget/TogetherlyWidget.swift', 'widget');

// Report legacy assumptions still present in TS/TSX so the next UI pass has a precise list.
const warnings = [];
for (const absolute of walk(file('src'))) {
  const text = fs.readFileSync(absolute, 'utf8');
  if (/participantPalettes\.(purple|green)|===\s*['"](?:purple|green)['"]/.test(text)) {
    warnings.push(path.relative(project, absolute));
  }
}
if (warnings.length) {
  fs.writeFileSync(file('RELEASE_A_IDENTITY_REMAINING.txt'), warnings.join('\r\n') + '\r\n', 'utf8');
  console.log(`Identity audit: ${warnings.length} source file(s) still contain legacy colour assumptions. See RELEASE_A_IDENTITY_REMAINING.txt`);
} else {
  console.log('Identity audit: no legacy Purple/Green assumptions remain in src.');
}

console.log('');
console.log('Release A identity foundation applied.');
console.log('Next run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
console.log('  npm.cmd run backend:migrate');
