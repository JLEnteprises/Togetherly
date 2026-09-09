import { useEffect, useState } from 'react';
import { realtimeClient } from '@/services/backend/realtime';
import { useWorkspace } from '@/providers/WorkspaceProvider';

export function usePartnerPresence(scope: string, active = true) {
  const { partnerProfile } = useWorkspace();
  const [partnerScope, setPartnerScope] = useState<string | null>(null);

  useEffect(() => {
    if (!active) setPartnerScope(null);

    const unsubscribe = realtimeClient.subscribe((event) => {
      if (event.type !== 'presence.snapshot') return;
      const partner = partnerProfile ? event.users.find((user) => user.userId === partnerProfile.id) : null;
      setPartnerScope(partner?.scope ?? null);
    });
    const releasePresence = active ? realtimeClient.claimPresence(scope) : () => undefined;

    return () => {
      releasePresence();
      unsubscribe();
    };
  }, [active, partnerProfile, scope]);

  return {
    hasPartner: Boolean(partnerProfile),
    partnerName: partnerProfile?.display_name || 'Your partner',
    partnerScope,
    isHere: Boolean(active && partnerProfile && partnerScope === scope),
  };
}
