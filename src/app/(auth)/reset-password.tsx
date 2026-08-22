import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { confirmPasswordReset } from '@/services/backend/auth';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function ResetPasswordScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const linkedToken = typeof params.token === 'string' ? params.token : '';
  const [token, setToken] = useState(linkedToken);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token.trim() || password.length < 8) {
      Alert.alert('Check the details', 'Enter the reset token and a password of at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(token, password);
      Alert.alert('Password changed', 'All previous sessions were signed out. You can now sign in with your new password.', [
        { text: 'Sign in', onPress: () => router.replace('/login') },
      ]);
    } catch (error) {
      Alert.alert('Couldn’t reset password', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen contentStyle={{ paddingTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xxxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}><AppText tone="accent">‹ Back</AppText></Pressable>
          <AppText variant="pageTitle">Choose a new password</AppText>
          <AppText tone="secondary">Choose a new password for your account. Reset links expire after 30 minutes.</AppText>
        </View>
        <View style={{ gap: theme.spacing.lg }}>
          {!linkedToken ? <FormField label="RESET CODE" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} placeholder="Enter your reset code" /> : null}
          <FormField label="NEW PASSWORD" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" />
          <AppButton label={busy ? 'Changing password…' : 'Change password'} disabled={busy} onPress={submit} />
        </View>
      </View>
    </AppScreen>
  );
}
