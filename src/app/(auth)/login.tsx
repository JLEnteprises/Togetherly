import { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { useAuth } from '@/providers/AuthProvider';
import { sendPasswordReset } from '@/services/backend/auth';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function LoginScreen() {
  const theme = useAppTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (error) {
      Alert.alert('Couldn’t sign in', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      Alert.alert('Enter your email first', 'Then tap Forgot password again.');
      return;
    }
    try {
      const result = await sendPasswordReset(email);
      if (result.developmentToken) {
        router.push({ pathname: '/reset-password', params: { token: result.developmentToken } });
      } else {
        Alert.alert('Check your email', 'If an account exists for that address, you’ll receive a password-reset link shortly.');
      }
    } catch (error) {
      Alert.alert('Couldn’t request reset', messageFrom(error));
    }
  }

  return (
    <AppScreen contentStyle={{ paddingTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xxxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}><AppText tone="accent">‹ Back</AppText></Pressable>
          <AppText variant="pageTitle">Welcome back</AppText>
          <AppText tone="secondary">Open your shared space and pick up where you left off.</AppText>
        </View>

        <View style={{ gap: theme.spacing.lg }}>
          <FormField label="EMAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
          <FormField label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Your password" />
          <Pressable accessibilityRole="button" onPress={resetPassword} style={{ alignSelf: 'flex-end' }}><AppText variant="bodySmall" tone="accent">Forgot password?</AppText></Pressable>
          <AppButton label={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={submit} />
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/register')}>
          <AppText align="center" tone="secondary">New here? <AppText tone="accent">Create an account</AppText></AppText>
        </Pressable>
      </View>
    </AppScreen>
  );
}
