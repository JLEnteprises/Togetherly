import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getEvents } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { expandEvents, type EventOccurrence } from '@/utils/calendar';

export function UpcomingEventCard() {
  const theme = useAppTheme(); const { colorForUser } = useWorkspace(); const [occurrence, setOccurrence] = useState<EventOccurrence | null>(null);
  const refresh = useCallback(async () => {
    const all = await getEvents();
    const now = new Date();
    const horizon = new Date(now.getTime() + 366 * 86_400_000);
    setOccurrence(expandEvents(all, now, horizon)[0] ?? null);
  }, []);
  const event = occurrence?.event ?? null;
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('events', refresh);
  return <Pressable accessibilityRole="button" onPress={() => router.push('/features/calendar' as never)}>{({ pressed }) => <Card participantColor={event ? colorForUser(event.creator_id) : 'both'} style={{ gap: theme.spacing.sm, opacity: pressed ? 0.76 : 1 }}><AppText variant="caption" tone="secondary">UP NEXT</AppText>{event ? <><AppText variant="section">{event.title}</AppText><ParticipantAttribution userId={event.creator_id} /><AppText variant="bodySmall" tone="secondary">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: event.all_day ? undefined : 'numeric', minute: event.all_day ? undefined : '2-digit' }).format(occurrence?.start ?? new Date(event.start_at))}{event.location ? ` · ${event.location}` : ''}</AppText></> : <><AppText variant="section">Nothing scheduled yet.</AppText><AppText variant="bodySmall" tone="secondary">Tap to add your first shared event.</AppText></>}</Card>}</Pressable>;
}
