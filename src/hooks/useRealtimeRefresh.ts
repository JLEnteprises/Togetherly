import { subscribeOfflineSynced } from '@/services/backend/api';
import { useEffect } from 'react';
import { realtimeClient, type RealtimeResource } from '@/services/backend/realtime';

export function useRealtimeRefresh(resource: RealtimeResource, refresh: () => void | Promise<void>) {
  useEffect(() => subscribeOfflineSynced(() => { Promise.resolve(refresh()).catch(() => undefined); }), [refresh]);
  useEffect(() => realtimeClient.subscribe((event) => {
    if (event.type === 'feature.updated' && event.resource === resource) {
      Promise.resolve(refresh()).catch(() => undefined);
    }
  }), [refresh, resource]);
}
