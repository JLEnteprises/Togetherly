import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Couple, CoupleInvite, ParticipantColor, Profile } from '@/types/database';
import { useAuth } from './AuthProvider';
import { getWorkspace } from '@/services/backend/workspace';
import { realtimeClient } from '@/services/backend/realtime';

const oppositeColor = (color: ParticipantColor): ParticipantColor => color === 'purple' ? 'green' : 'purple';

type WorkspaceContextValue = {
  profile: Profile | null;
  couple: Couple | null;
  activeInvite: CoupleInvite | null;
  memberCount: number;
  partnerProfile: Profile | null;
  myColor: ParticipantColor;
  partnerColor: ParticipantColor;
  colorForUser: (userId: string | null | undefined) => ParticipantColor | 'both';
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { user, isConfigured } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [activeInvite, setActiveInvite] = useState<CoupleInvite | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [myColor, setMyColor] = useState<ParticipantColor>('purple');
  const [partnerColor, setPartnerColor] = useState<ParticipantColor>('green');
  const [isLoading, setIsLoading] = useState(Boolean(user && isConfigured));
  const [error, setError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const clearWorkspace = useCallback(() => {
    setProfile(null);
    setCouple(null);
    setActiveInvite(null);
    setMemberCount(0);
    setPartnerProfile(null);
    setMyColor('purple');
    setPartnerColor('green');
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !isConfigured) {
      clearWorkspace();
      setLoadedUserId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await getWorkspace();
      setProfile(snapshot.profile);
      setCouple(snapshot.couple);
      setActiveInvite(snapshot.activeInvite);
      setMemberCount(snapshot.memberCount);
      setPartnerProfile(snapshot.partnerProfile);
      const nextMyColor = snapshot.myColor ?? snapshot.profile.preferred_participant_color ?? 'purple';
      setMyColor(nextMyColor);
      setPartnerColor(snapshot.partnerColor ?? oppositeColor(nextMyColor));
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Unable to reach the Togetherly backend.';
      setError(message);
      throw refreshError;
    } finally {
      setLoadedUserId(user.id);
      setIsLoading(false);
    }
  }, [clearWorkspace, isConfigured, user]);

  useEffect(() => {
    refresh().catch((refreshError: unknown) => {
      const message = refreshError instanceof Error ? refreshError.message : 'Unknown workspace error';
      console.warn('Unable to load Togetherly workspace:', message);
    });
  }, [refresh]);

  useEffect(() => {
    if (!user || !couple?.id) return;
    return realtimeClient.subscribe((event) => {
      if (event.type === 'workspace.updated') refresh().catch(() => undefined);
    });
  }, [couple?.id, refresh, user]);

  const workspaceIsLoading = isLoading || Boolean(user && loadedUserId !== user.id);

  const colorForUser = useCallback((userId: string | null | undefined): ParticipantColor | 'both' => {
    if (!userId || !profile?.id) return 'both';
    if (userId === profile.id) return myColor;
    if (partnerProfile && userId === partnerProfile.id) return partnerColor;
    return 'both';
  }, [myColor, partnerColor, partnerProfile, profile?.id]);

  const value = useMemo<WorkspaceContextValue>(() => ({
    profile,
    couple,
    activeInvite,
    memberCount,
    partnerProfile,
    myColor,
    partnerColor,
    colorForUser,
    isLoading: workspaceIsLoading,
    error,
    refresh,
  }), [activeInvite, colorForUser, couple, error, memberCount, myColor, partnerColor, partnerProfile, profile, refresh, workspaceIsLoading]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return value;
}
