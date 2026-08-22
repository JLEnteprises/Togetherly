import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { useAuth } from '@/providers/AuthProvider';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }

export default function RegisterScreen() {
  const theme = useAppTheme();
  const { signUp } = useAuth();
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) { Alert.alert('Missing details', 'Add your email and password.'); return; }
    if (password.length < 8) { Alert.alert('Use a stronger password', 'Please use at least 8 characters.'); return; }
    setBusy(true);
    try { await signUp({ email, password, timezone }); }
    catch (error) { Alert.alert('Couldn’t create account', messageFrom(error)); }
    finally { setBusy(false); }
  }

  return (
    <AppScreen contentStyle={{ paddingTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xxxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}><AppText tone="accent">‹ Back</AppText></Pressable>
          <AppText variant="pageTitle">Create your account</AppText>
          <AppText tone="secondary">Start with your private login. Your name, photo and timezone come next; you’ll choose your colour when you create your shared space.</AppText>
        </View>
        <View style={{ gap: theme.spacing.lg }}>
          <FormField label="EMAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
          <FormField label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" />
          <AppButton label={busy ? 'Creating account…' : 'Continue'} disabled={busy} onPress={submit} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/login')}><AppText align="center" tone="secondary">Already registered? <AppText tone="accent">Sign in</AppText></AppText></Pressable>
      </View>
    </AppScreen>
  );
}
