import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useAuth } from './AuthProvider';
import type { UserPreferences } from '@/types/database';
import { getPreferences, updatePreferences } from '@/services/backend/mvpFeatures';

const defaults: UserPreferences = {
  user_id: '',
  reduced_motion: false,
  haptics: true,
  high_contrast: false,
  notification_events: true,
  notification_tasks: true,
  notification_countdowns: true,
  notification_partner_activity: true,
  notification_daily_question: true,
  notification_partner_mood: true,
  notification_goal_milestones: true,
  notification_memories: true,
  notification_visit_approaching: true,
  notification_relationship_pings: true,
  backdrop_theme: 'dual_orbit',
  created_at: '',
  updated_at: '',
};

type PreferencePatch = Partial<{
  reducedMotion: boolean;
  haptics: boolean;
  highContrast: boolean;
  notificationEvents: boolean;
  notificationTasks: boolean;
  notificationCountdowns: boolean;
  notificationPartnerActivity: boolean;
  notificationDailyQuestion: boolean;
  notificationPartnerMood: boolean;
  notificationGoalMilestones: boolean;
  notificationMemories: boolean;
  notificationVisitApproaching: boolean;
  notificationRelationshipPings: boolean;
  backdropTheme: UserPreferences['backdrop_theme'];
}>;

type Value = {
  preferences: UserPreferences;
  isLoading: boolean;
  save: (patch: PreferencePatch) => Promise<void>;
  refresh: () => Promise<void>;
};

const PreferencesContext = createContext<Value | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const { user, isConfigured } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(defaults);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !isConfigured) {
      setPreferences(defaults);
      return;
    }
    setIsLoading(true);
    try { setPreferences(await getPreferences()); }
    catch (error) { console.warn('Unable to load preferences:', error instanceof Error ? error.message : error); }
    finally { setIsLoading(false); }
  }, [isConfigured, user]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);

  const save = useCallback(async (patch: PreferencePatch) => {
    const next = await updatePreferences(patch);
    setPreferences(next);
  }, []);

  const value = useMemo(() => ({ preferences, isLoading, save, refresh }), [isLoading, preferences, refresh, save]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider.');
  return value;
}
