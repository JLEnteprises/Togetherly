import { useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import { Alert, Linking, Platform, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { ToggleRow } from '@/components/common/ToggleRow';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { usePreferences } from '@/providers/PreferencesProvider';
import { usePushNotifications } from '@/providers/PushNotificationsProvider';
import { useWatchBridge } from '@/providers/WatchBridgeProvider';
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead, refreshScheduledReminders } from '@/services/backend/mvpFeatures';
import { realtimeClient } from '@/services/backend/realtime';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon } from '@/components/art/AppIcon';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import type { InAppNotification } from '@/types/database';
import { notificationHref } from '@/utils/recordRoutes';
import { useState } from 'react';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function notificationTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const { colorForUser, partnerProfile } = useWorkspace();
  const { preferences, save } = usePreferences();
  const push = usePushNotifications();
  const watch = useWatchBridge();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      await refreshScheduledReminders();
      const result = await getNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (error) {
      Alert.alert('Couldn’t load notifications', messageFrom(error));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useEffect(() => realtimeClient.subscribe((event) => {
    if (event.type === 'feature.updated' || event.type === 'workspace.updated' || event.type === 'shared_item.updated') {
      refresh().catch(() => undefined);
    }
  }), [refresh]);

  async function change(patch: Parameters<typeof save>[0]) {
    try { await save(patch); }
    catch (error) { Alert.alert('Couldn’t save notification setting', messageFrom(error)); }
  }
  async function openNotification(item: InAppNotification) {
    try {
      if (!item.read_at) {
        const updated = await markNotificationRead(item.id);
        setNotifications((current) => current.map((entry) => entry.id === item.id ? updated : entry));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      const href = notificationHref(item.entity_type, item.entity_id);
      if (href) router.push(href as never);
    } catch (error) { Alert.alert('Couldn’t open notification', messageFrom(error)); }
  }
  async function readAll() {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((current) => current.map((entry) => ({ ...entry, read_at: entry.read_at ?? now })));
      setUnreadCount(0);
    } catch (error) { Alert.alert('Couldn’t mark notifications read', messageFrom(error)); }
  }
  async function remove(id: string) {
    try {
      await deleteNotification(id);
      setNotifications((current) => current.filter((entry) => entry.id !== id));
      await refresh();
    } catch (error) { Alert.alert('Couldn’t delete notification', messageFrom(error)); }
  }

  async function enablePush() {
    try {
      const next = await push.enable();
      if (next.permission !== 'granted' && next.reason) Alert.alert('Notifications are off', next.reason);
    } catch (error) { Alert.alert('Couldn’t enable push', messageFrom(error)); }
  }
  async function testPush() {
    try { await push.sendTest(); Alert.alert('Sent', 'A Togetherly test notification is on its way.'); }
    catch (error) { Alert.alert('Couldn’t send test', messageFrom(error)); }
  }
  async function disablePush() {
    try { await push.disable(); }
    catch (error) { Alert.alert('Couldn’t disconnect this device', messageFrom(error)); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Settings" title="Notifications" subtitle="Updates from your shared space." />

      <Card participantColor="both" tone="secondary" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft }}><AppIcon name="notification" size={21} color={theme.colors.accent} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="cardTitle">Push notifications</AppText>
            <AppText variant="bodySmall" tone="secondary">{!push.status.supported ? (push.status.reason ?? 'Available in the native app.') : push.status.registered ? 'This device is connected. Togetherly can reach you when the app is closed.' : push.status.permission === 'denied' ? 'Permission is off in system settings.' : 'Choose when you’re ready — Togetherly won’t ask on first launch.'}</AppText>
          </View>
        </View>
        {push.status.supported ? <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {!push.status.registered && push.status.permission !== 'denied' ? <AppButton compact label={push.isLoading ? 'Connecting…' : 'Enable push'} icon="notification" disabled={push.isLoading} onPress={enablePush} /> : null}
          {push.status.permission === 'denied' ? <AppButton compact label="Open system settings" variant="secondary" onPress={() => Linking.openSettings()} /> : null}
          {push.status.registered ? <AppButton compact label="Send test" variant="secondary" onPress={testPush} /> : null}
          {push.status.registered ? <AppButton compact label="Disconnect device" variant="ghost" onPress={disablePush} /> : null}
        </View> : null}
      </Card>

      {Platform.OS === 'ios' ? <Card style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.secondarySoft }}><AppIcon name="heart" size={20} color={theme.colors.partnerAccent} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="cardTitle">Apple Watch & widgets</AppText>
            <AppText variant="bodySmall" tone="secondary">{watch.status.watchAppInstalled ? (watch.status.reachable ? 'Togetherly Watch is installed and reachable.' : 'Togetherly Watch is installed. Latest state will sync when available.') : watch.status.paired ? 'An Apple Watch is paired. Install the Togetherly Watch companion with the next native build.' : 'Partner status, Love Tap, next visit and Daily Question can live on your wrist and Lock Screen.'}</AppText>
          </View>
        </View>
        <AppButton compact variant="secondary" label={watch.isSyncing ? 'Syncing…' : 'Refresh Watch state'} disabled={watch.isSyncing} onPress={() => watch.refresh().catch((error) => Alert.alert('Couldn’t sync Watch', messageFrom(error)))} />
      </Card> : null}

      <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View><AppText variant="section">Inbox</AppText><AppText variant="bodySmall" tone="secondary">{unreadCount} unread</AppText></View>
          {unreadCount > 0 ? <AppButton compact variant="secondary" label="Mark all read" onPress={readAll} /> : null}
        </View>
        {loading ? <AppText tone="muted">Loading notifications…</AppText> : null}
        {!loading && notifications.length === 0 ? <EmptyState icon="notification" title="Nothing new" body={partnerProfile ? `Updates from ${partnerProfile.display_name} and reminders you’ve chosen will appear here.` : 'Shared updates and reminders you’ve chosen will appear here.'} /> : null}
        {notifications.map((item) => (
          <Pressable accessibilityRole="button" key={item.id} onPress={() => openNotification(item)}>
            {({ pressed }) => (
              <Card participantColor={item.actor_user_id ? colorForUser(item.actor_user_id) : 'both'} tone={item.read_at ? 'default' : 'secondary'} style={{ gap: 7, opacity: pressed ? 0.72 : 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {!item.read_at ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent }} /> : null}
                      <AppText variant="cardTitle">{item.title}</AppText>
                    </View>
                    {item.actor_user_id ? <ParticipantAttribution userId={item.actor_user_id} /> : null}
                    {item.body ? <AppText variant="bodySmall" tone="secondary">{item.body}</AppText> : null}
                    <AppText variant="caption" tone="muted">{notificationTime(item.created_at)}</AppText>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={(event) => { event.stopPropagation(); remove(item.id).catch(() => undefined); }} hitSlop={8}><AppIcon name="close" size={15} color={theme.colors.textMuted} /></Pressable>
                </View>
              </Card>
            )}
          </Pressable>
        ))}
      </View>

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="section" style={{ marginBottom: theme.spacing.sm }}>What reaches your inbox</AppText>
        <ToggleRow label="Upcoming events" subtitle="Shared changes and events starting within 24 hours." value={preferences.notification_events} onChange={(value) => change({ notificationEvents: value })} />
        <ToggleRow label="Tasks" subtitle="Shared changes and tasks due within 24 hours." value={preferences.notification_tasks} onChange={(value) => change({ notificationTasks: value })} />
        <ToggleRow label="Countdowns" subtitle="Milestones at 100, 60, 30, 14, 7, 3, 1 days and today." value={preferences.notification_countdowns} onChange={(value) => change({ notificationCountdowns: value })} />
        <ToggleRow label={partnerProfile ? `Updates from ${partnerProfile.display_name}` : "Shared activity"} subtitle="Lists, notes, trips and other shared changes." value={preferences.notification_partner_activity} onChange={(value) => change({ notificationPartnerActivity: value })} />
        <ToggleRow label="Love & little signals" subtitle="Love taps, Thinking of You and lightweight connection moments." value={preferences.notification_relationship_pings} onChange={(value) => change({ notificationRelationshipPings: value })} />
        <ToggleRow label="Daily question" subtitle="A daily inbox reminder after 8 AM if you have not answered." value={preferences.notification_daily_question} onChange={(value) => change({ notificationDailyQuestion: value })} />
        <ToggleRow label={partnerProfile ? `${partnerProfile.display_name} check-ins` : "Shared check-ins"} value={preferences.notification_partner_mood} onChange={(value) => change({ notificationPartnerMood: value })} />
        <ToggleRow label="Goal milestones" subtitle="Shared progress plus goals due within seven days." value={preferences.notification_goal_milestones} onChange={(value) => change({ notificationGoalMilestones: value })} />
        <ToggleRow label="New memories" value={preferences.notification_memories} onChange={(value) => change({ notificationMemories: value })} />
        <ToggleRow label="Visit approaching" subtitle="Visit/flight milestones as the date gets closer." value={preferences.notification_visit_approaching} onChange={(value) => change({ notificationVisitApproaching: value })} />
      </Card>
    </AppScreen>
  );
}
