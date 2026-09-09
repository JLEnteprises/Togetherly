import { useEffect, useState } from 'react';
import { realtimeClient } from '@/services/backend/realtime';
import { useWorkspace } from '@/providers/WorkspaceProvider';

export function usePartnerPresence(scope: string) {
  const { partnerProfile } = useWorkspace();
  const [partnerScope, setPartnerScope] = useState<string | null>(null);

  useEffect(() => {
    const releasePresence = realtimeClient.claimPresence(scope);
    const unsubscribe = realtimeClient.subscribe((event) => {
      if (event.type !== 'presence.snapshot') return;
      const partner = partnerProfile ? event.users.find((user) => user.userId === partnerProfile.id) : null;
      setPartnerScope(partner?.scope ?? null);
    });
    return () => {
      releasePresence();
      unsubscribe();
    };
  }, [partnerProfile, scope]);

  return {
    hasPartner: Boolean(partnerProfile),
    partnerName: partnerProfile?.display_name || 'Your partner',
    isHere: Boolean(partnerProfile && partnerScope === scope),
  };
}
