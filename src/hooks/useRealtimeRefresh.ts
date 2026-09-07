import { useEffect } from 'react';
import { realtimeClient, type RealtimeResource } from '@/services/backend/realtime';

export function useRealtimeRefresh(resource: RealtimeResource, refresh: () => void | Promise<void>) {
  useEffect(() => realtimeClient.subscribe((event) => {
    if (event.type === 'feature.updated' && event.resource === resource) {
      Promise.resolve(refresh()).catch(() => undefined);
    }
  }), [refresh, resource]);
}
