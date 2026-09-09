import { useState } from 'react';
import { View } from 'react-native';
import { useStaleData } from '@/services/backend/freshness';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
const labels: Record<string,string> = {tasks:'Tasks',events:'Calendar',notes:'Notes',lists:'Lists',countdowns:'Countdowns',trips:'Trips',goals:'Goals',memories:'Memories',photos:'Photos',moods:'Check-ins','daily-question':'Daily question',activities:'Ideas','date-proposals':'Date plans','time-capsules':'Capsules',availability:'Availability',games:'Games',timeline:'Timeline'};
export function SyncStatus({ resources, retry }: { resources: string[]; retry: () => void | Promise<void> }) {
  const stale = useStaleData();
  const [busy, setBusy] = useState(false);
  const affected = [...new Set(stale.split(',').map((path) => path.split('/')[1]?.split('?')[0] || '').filter((resource) => resources.includes(resource)))];
  if (!affected.length) return null;
  return <View style={{gap:6}} accessibilityLiveRegion="polite">
    <AppText variant="bodySmall" tone="warning">{affected.map((r) => labels[r] || r).join(', ')} couldn’t refresh. Saved information may be out of date.</AppText>
    <AppButton compact variant="ghost" label={busy ? 'Retrying…' : 'Retry update'} disabled={busy} onPress={async () => { setBusy(true); try { await retry(); } catch { /* Keep the scoped status visible. */ } finally { setBusy(false); } }} />
  </View>;
}
