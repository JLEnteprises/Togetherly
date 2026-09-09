import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { ParticipantColor } from '@/types/database';
import { AppIcon, isAppIconName } from '@/components/art/AppIcon';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { EyebrowText } from '@/components/common/EyebrowText';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { useAppTheme } from '@/theme/useAppTheme';

export type ExpandableFeatureGroupItem = {
  key?: string;
  icon?: string;
  title: string;
  subtitle?: string;
  status?: string;
  href?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

type Props = {
  eyebrow?: string;
  icon?: string;
  title: string;
  summary: string;
  status?: string;
  items?: readonly ExpandableFeatureGroupItem[];
  children?: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  accent?: boolean;
  participantColor?: ParticipantColor | 'both';
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

// G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION: compact summaries reveal navigation/actions progressively without duplicating feature homes.
export function ExpandableFeatureGroup({
  eyebrow,
  icon,
  title,
  summary,
  status,
  items = [],
  children,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  accent = false,
  participantColor,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const open = expanded ?? localExpanded;

  function toggle() {
    const next = !open;
    feedback();
    if (expanded === undefined) setLocalExpanded(next);
    onExpandedChange?.(next);
  }

  return (
    <Card
      tone={accent ? 'accent' : 'default'}
      participantColor={participantColor}
      style={{ padding: 0, overflow: 'hidden' }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={accessibilityLabel ?? `${title}. ${summary}${status ? `. ${status}` : ''}`}
        accessibilityHint={accessibilityHint ?? (open ? 'Collapse this section' : 'Expand this section')}
        onPress={toggle}
        style={({ pressed }) => ({
          minHeight: 76,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent',
          opacity: pressed ? 0.82 : 1,
        })}
      >
        {icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: accent ? theme.colors.elevatedBackground : theme.colors.accentSoft,
            }}
          >
            {isAppIconName(icon)
              ? <AppIcon name={icon} size={19} color={theme.colors.accent} />
              : <AppText variant="cardTitle" tone="accent">{icon}</AppText>}
          </View>
        ) : null}

        <View style={{ flex: 1, gap: 3 }}>
          {eyebrow ? <EyebrowText tone={accent ? 'accent' : 'secondary'}>{eyebrow}</EyebrowText> : null}
          <AppText variant="section">{title}</AppText>
          <AppText variant="bodySmall" tone="secondary">{summary}</AppText>
        </View>

        {status ? (
          <View
            style={{
              maxWidth: 120,
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: theme.colors.elevatedBackground,
            }}
          >
            <AppText variant="caption" tone="secondary" numberOfLines={1}>{status}</AppText>
          </View>
        ) : null}

        <AppIcon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={theme.colors.textMuted} />
      </Pressable>

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}>
          {children ? (
            <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
              {children}
            </View>
          ) : null}

          {items.length ? (
            <View style={{ paddingHorizontal: theme.spacing.sm }}>
              {items.map((item, index) => {
                const activate = item.onPress ?? (item.href ? () => router.push(item.href as never) : undefined);
                const rowKey = item.key ?? item.href ?? item.title;
                return (
                  <Pressable
                    key={rowKey}
                    accessibilityRole="button"
                    accessibilityLabel={item.accessibilityLabel ?? [item.title, item.subtitle, item.status].filter(Boolean).join('. ')}
                    accessibilityState={{ disabled: !activate }}
                    disabled={!activate}
                    onPress={() => {
                      if (!activate) return;
                      feedback();
                      activate();
                    }}
                    style={({ pressed }) => ({
                      minHeight: 58,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 10,
                      borderTopWidth: index === 0 && !children ? 0 : 1,
                      borderTopColor: theme.colors.border,
                      backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent',
                      borderRadius: pressed ? theme.radii.sm : 0,
                      opacity: !activate ? 0.52 : pressed ? 0.76 : 1,
                    })}
                  >
                    {item.icon ? (
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: theme.colors.accentSoft,
                        }}
                      >
                        {isAppIconName(item.icon)
                          ? <AppIcon name={item.icon} size={18} color={theme.colors.accent} />
                          : <AppText variant="cardTitle" tone="accent">{item.icon}</AppText>}
                      </View>
                    ) : null}

                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="cardTitle">{item.title}</AppText>
                      {item.subtitle ? <AppText variant="caption" tone="muted">{item.subtitle}</AppText> : null}
                    </View>

                    {item.status ? (
                      <AppText variant="caption" tone="secondary" numberOfLines={1}>{item.status}</AppText>
                    ) : null}

                    {activate ? <AppIcon name="chevron" size={16} color={theme.colors.textMuted} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
