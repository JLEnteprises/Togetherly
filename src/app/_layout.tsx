import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { WorkspaceProvider, useWorkspace } from '@/providers/WorkspaceProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { BackendSetupScreen } from '@/components/common/BackendSetupScreen';
import { BackendUnavailableScreen } from '@/components/common/BackendUnavailableScreen';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { useAppTheme } from '@/theme/useAppTheme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <PreferencesProvider>
          <RootNavigator />
        </PreferencesProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const theme = useAppTheme();
  const { session, isLoading: authLoading, isConfigured } = useAuth();
  const { profile, couple, isLoading: workspaceLoading, error: workspaceError, refresh } = useWorkspace();

  if (!isConfigured) return <BackendSetupScreen />;
  if (authLoading || (session && workspaceLoading && !profile)) return <LoadingScreen />;
  if (session && workspaceError) return <BackendUnavailableScreen message={workspaceError} onRetry={refresh} />;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: theme.reducedMotion ? 'none' : 'fade_from_bottom' }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session && (!profile?.onboarding_complete || !couple))}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session && profile?.onboarding_complete && couple)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="features" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
