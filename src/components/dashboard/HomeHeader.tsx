import { CoupleAvatar } from '@/components/common/Avatar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { getNotifications } from '@/services/backend/mvpFeatures';
import { realtimeClient } from '@/services/backend/realtime';
import { useFocusEffect } from 'expo-router';

export function HomeHeader() {
  const { profile, partnerProfile } = useWorkspace();
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => { getNotifications().then((result) => setUnread(result.unreadCount)).catch(() => undefined); }, []);
  useFocusEffect(refresh);
  useEffect(() => realtimeClient.subscribe((event) => { if (event.type === 'feature.updated' && ['date_proposals','time_capsules','relationship_pings','moods','questions','events'].includes(event.resource)) refresh(); }), [refresh]);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  let partnerTime = '';
  try { if (partnerProfile) partnerTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: partnerProfile.timezone }).format(now); } catch { /* Missing timezone is optional. */ }
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>TOGETHERLY</AppText>
      <IconButton icon="search" label="Search your shared space" onPress={() => router.push('/features/search')} />
      <IconButton icon="notification" label={`Inbox${unread ? `, ${unread} unread` : ''}`} onPress={() => router.push('/features/inbox' as never)} />
      <IconButton icon="settings" label="Account and settings" onPress={() => router.push('/(tabs)/more')} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <AppText variant="pageTitle" accessibilityRole="header" style={{ flex: 1 }}>{profile?.display_name || 'You'}{partnerProfile ? ` + ${partnerProfile.display_name}` : ''}</AppText>
      <CoupleAvatar />
    </View>
    {unread > 0 ? <AppText variant="caption" tone="accent" onPress={() => router.push('/features/inbox' as never)}>{unread} unread in your inbox</AppText> : null}
    {partnerTime ? <AppText variant="bodySmall" tone="secondary">{partnerProfile?.display_name}’s time · {partnerTime}</AppText> : null}
  </View>;
}
