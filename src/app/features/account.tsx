import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { TimezonePickerField } from '@/components/common/TimezonePickerField';
import { ToggleRow } from '@/components/common/ToggleRow';
import { useLocationSharing } from '@/providers/LocationProvider';
import { PhotoPickerField } from '@/components/common/PhotoPickerField';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { updateProfile } from '@/services/backend/workspace';
import { changeAccountPassword, deleteAccount, exportAccountData, refreshCurrentUser, signOutAllDevices, updateAccountEmail } from '@/services/backend/auth';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
type OpenPanel = 'email' | 'password' | 'sessions' | 'delete' | null;

export default function AccountScreen() {
  const theme = useAppTheme();
  const detectedTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const { profile, myColor, refresh } = useWorkspace();
  const { refreshAutomaticTimezone } = useLocationSharing();
  const { signOut } = useAuth();
  const [name, setName] = useState(''); const [timezone, setTimezone] = useState(''); const [timezoneMode, setTimezoneMode] = useState<'automatic' | 'manual'>('automatic'); const [photo, setPhoto] = useState<string | null>(null);
  const [email, setEmail] = useState(''); const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState(''); const [deletePhrase, setDeletePhrase] = useState('');
  const [busy, setBusy] = useState<string | null>(null); const [open, setOpen] = useState<OpenPanel>(null);

  useEffect(() => { if (!profile) return; setName(profile.display_name); setTimezone(profile.timezone); setTimezoneMode(profile.timezone_mode ?? 'automatic'); setPhoto(profile.avatar_url); setEmail(profile.email); }, [profile?.id, profile?.display_name, profile?.timezone, profile?.timezone_mode, profile?.avatar_url, profile?.email]);
  const toggle = (panel: Exclude<OpenPanel, null>) => setOpen((current) => current === panel ? null : panel);

  async function saveProfile() {
    if (!name.trim() || !timezone.trim()) return;
    setBusy('profile');
    try { let chosenTimezone=timezone.trim(); if(timezoneMode==='automatic'){chosenTimezone=(await refreshAutomaticTimezone()) ?? detectedTimezone;} await updateProfile({ displayName: name.trim(), timezone: chosenTimezone, timezoneMode, avatarUrl: photo }); setTimezone(chosenTimezone); await refreshCurrentUser(); await refresh(); Alert.alert('Saved', 'Your profile has been updated.'); }
    catch (error) { Alert.alert('Couldn’t save profile', messageFrom(error)); }
    finally { setBusy(null); }
  }

  async function saveEmail() {
    if (!email.trim() || !emailPassword) return;
    setBusy('email');
    try { await updateAccountEmail(email, emailPassword); await refresh(); setEmailPassword(''); setOpen(null); Alert.alert('Email updated', 'Your sign-in email has been changed.'); }
    catch (error) { Alert.alert('Couldn’t update email', messageFrom(error)); }
    finally { setBusy(null); }
  }

  async function changePasswordNow() {
    if (newPassword.length < 8 || newPassword !== confirmPassword) { Alert.alert('Check the password', newPassword !== confirmPassword ? 'The new passwords do not match.' : 'Use at least 8 characters.'); return; }
    setBusy('password');
    try { await changeAccountPassword(currentPassword, newPassword); Alert.alert('Password changed', 'You were signed out on every device. Sign in again with your new password.'); }
    catch (error) { Alert.alert('Couldn’t change password', messageFrom(error)); setBusy(null); }
  }

  function allDevices() {
    Alert.alert('Sign out everywhere?', 'This will end every Togetherly session for this account, including this one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out all', style: 'destructive', onPress: () => { setBusy('sessions'); signOutAllDevices().catch((error) => { setBusy(null); Alert.alert('Couldn’t sign out', messageFrom(error)); }); } },
    ]);
  }

  async function exportData() {
    setBusy('export');
    try {
      const data = await exportAccountData();
      const text = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([text], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = href; anchor.download = `togetherly-export-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
        URL.revokeObjectURL(href);
      } else {
        await Share.share({ title: 'Togetherly data export', message: text });
      }
    } catch (error) { Alert.alert('Couldn’t export your data', messageFrom(error)); }
    finally { setBusy(null); }
  }

  function removeAccount() {
    if (deletePhrase.trim().toUpperCase() !== 'DELETE') { Alert.alert('Confirmation needed', 'Type DELETE exactly to confirm.'); return; }
    if (!deletePassword) { Alert.alert('Password needed', 'Enter your current password to delete the account.'); return; }
    Alert.alert('Delete your account?', 'This permanently removes your login and private content. If your partner remains, shared history stays with neutral “Previous member” attribution. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => { setBusy('delete'); deleteAccount(deletePassword).catch((error) => { setBusy(null); Alert.alert('Couldn’t delete account', messageFrom(error)); }); } },
    ]);
  }

  return <AppScreen>
    <BackHeader eyebrow="Account" title="Account & profile" subtitle="Profile, sign-in and security." />
    <Card participantColor={myColor} style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
      <View style={{ gap: 4 }}><AppText variant="section">{profile?.display_name ?? 'Your profile'}</AppText><AppText tone="secondary">{profile?.email}</AppText></View>
      <PhotoPickerField label="PROFILE PHOTO" value={photo} onChange={setPhoto} circular />
      <FormField label="DISPLAY NAME" value={name} onChangeText={setName} placeholder="Your name" />
      <ToggleRow label="Automatic timezone" subtitle="Use your location to keep local time correct." value={timezoneMode === 'automatic'} onChange={(value) => setTimezoneMode(value ? 'automatic' : 'manual')} />
      {timezoneMode === 'manual' ? <TimezonePickerField value={timezone} onChange={setTimezone} /> : <View style={{ gap: 4 }}><AppText variant="caption" tone="secondary">TIMEZONE</AppText><AppText>{timezone}</AppText><AppText variant="caption" tone="muted">Set automatically from your location.</AppText></View>}
      {timezoneMode === 'manual' && timezone !== detectedTimezone ? <AppButton compact variant="ghost" label={`Use device timezone · ${detectedTimezone}`} onPress={() => setTimezone(detectedTimezone)} /> : null}
      <AppButton label={busy === 'profile' ? 'Saving…' : 'Save profile'} disabled={Boolean(busy) || !name.trim() || !timezone.trim()} onPress={saveProfile} />
    </Card>

    <View style={{ gap: theme.spacing.md }}>
      <CollapsibleComposer title="Sign-in email" subtitle={profile?.email ?? ''} actionLabel="Change" closeLabel="Close" open={open === 'email'} onToggle={() => toggle('email')}>
        <FormField label="NEW EMAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <FormField label="CURRENT PASSWORD" value={emailPassword} onChangeText={setEmailPassword} secureTextEntry />
        <AppButton compact label={busy === 'email' ? 'Saving…' : 'Update email'} disabled={Boolean(busy) || !email.trim() || !emailPassword} onPress={saveEmail} />
      </CollapsibleComposer>

      <CollapsibleComposer title="Password" subtitle="Change your password and sign out old sessions." actionLabel="Change" closeLabel="Close" open={open === 'password'} onToggle={() => toggle('password')}>
        <FormField label="CURRENT PASSWORD" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <FormField label="NEW PASSWORD" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 8 characters" />
        <FormField label="CONFIRM NEW PASSWORD" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <AppButton compact label={busy === 'password' ? 'Changing…' : 'Change password'} disabled={Boolean(busy) || !currentPassword || !newPassword || !confirmPassword} onPress={changePasswordNow} />
        <AppText variant="caption" tone="muted">Changing your password signs this account out on every device.</AppText>
      </CollapsibleComposer>

      <CollapsibleComposer title="Signed-in devices" subtitle="End this session or every active session." actionLabel="Manage" closeLabel="Close" open={open === 'sessions'} onToggle={() => toggle('sessions')}>
        <AppButton compact variant="ghost" label={busy === 'sessions' ? 'Signing out…' : 'Sign out on all devices'} disabled={Boolean(busy)} onPress={allDevices} />
        <AppButton compact variant="ghost" label="Sign out on this device" disabled={Boolean(busy)} onPress={() => signOut().catch((error) => Alert.alert('Couldn’t sign out', messageFrom(error)))} />
      </CollapsibleComposer>

      <Card tone="secondary" style={{ gap: theme.spacing.md }}>
        <AppText variant="section">Your data</AppText>
        <AppText tone="secondary">Save a JSON copy of your profile, your private entries and the shared content you can access. Passwords and session keys are never included.</AppText>
        <AppButton compact variant="ghost" label={busy === 'export' ? 'Preparing…' : 'Export my data'} disabled={Boolean(busy)} onPress={exportData} />
      </Card>

      <CollapsibleComposer title="Delete account" subtitle="Permanently remove your login and private content." actionLabel="Review" closeLabel="Close" open={open === 'delete'} onToggle={() => toggle('delete')} tone="secondary">
        <AppText tone="secondary">Shared history can remain for your partner with anonymous attribution. This cannot be undone.</AppText>
        <FormField label="TYPE DELETE" value={deletePhrase} onChangeText={setDeletePhrase} autoCapitalize="characters" />
        <FormField label="CURRENT PASSWORD" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry />
        <AppButton variant="danger" label={busy === 'delete' ? 'Deleting…' : 'Delete my account'} disabled={Boolean(busy) || deletePhrase.trim().toUpperCase() !== 'DELETE' || !deletePassword} onPress={removeAccount} />
      </CollapsibleComposer>
    </View>
  </AppScreen>;
}
