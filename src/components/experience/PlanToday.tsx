import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { getEvents } from '@/services/backend/mvpFeatures';
import { getDateProposals } from '@/services/backend/experience';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { expandEvents, type EventOccurrence } from '@/utils/calendar';
import { formatInZone } from '@/utils/experience';
export function PlanToday() {
  const { profile } = useWorkspace();
  const [events, setEvents] = useState<EventOccurrence[]>([]);
  const [waiting, setWaiting] = useState(0);
  const refresh = useCallback(async () => {
    const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const results = await Promise.allSettled([getEvents(), getDateProposals()]);
    if (results[0].status === 'fulfilled') setEvents(expandEvents(results[0].value, now, end).slice(0, 3));
    if (results[1].status === 'fulfilled') setWaiting(results[1].value.filter((plan) => plan.status === 'pending' && plan.proposer_id !== profile?.id).length);
  }, [profile?.id]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useRealtimeRefresh('events', refresh); useRealtimeRefresh('date_proposals', refresh);
  return <View style={{ gap: 12 }}>
    <AppButton label={waiting ? `${waiting} date proposal${waiting === 1 ? '' : 's'} to answer` : 'Plan time together'} onPress={() => router.push('/features/date-plans' as never)} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <AppButton compact variant="secondary" label="Calendar" onPress={() => router.push('/features/calendar')} />
      <AppButton compact variant="secondary" label="Tasks" onPress={() => router.push('/features/tasks')} />
    </View>
    {events.length ? <Card style={{ gap: 10 }}><AppText variant="cardTitle">Coming up today</AppText>{events.map((item) => <AppButton key={`${item.event.id}-${item.start.toISOString()}`} variant="ghost" label={`${item.event.title} · ${item.event.all_day ? 'All day' : formatInZone(item.start.toISOString(), profile?.timezone)}`} onPress={() => router.push(`/features/calendar?focus=${item.event.id}` as never)} />)}</Card> : null}
  </View>;
}
