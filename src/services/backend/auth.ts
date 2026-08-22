import type { AuthSession, Profile } from '@/types/database';
import { ApiClientError, apiRequest, getStoredSession, initializeStoredSession, storeSession } from './api';

type AuthResponse = AuthSession;

async function mergeStoredUser(user: Profile) {
  const current = getStoredSession();
  if (current) await storeSession({ ...current, user });
  return user;
}

export async function restoreAuthSession(): Promise<AuthSession | null> {
  await initializeStoredSession();
  const existing = getStoredSession();
  if (!existing) return null;
  try {
    const result = await apiRequest<{ user: Profile }>('/auth/me');
    const current = getStoredSession();
    if (!current) return null;
    const next = { ...current, user: result.user };
    await storeSession(next);
    return next;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 0) return existing;
    await storeSession(null);
    return null;
  }
}

export async function refreshCurrentUser() {
  const result = await apiRequest<{ user: Profile }>('/auth/me');
  return mergeStoredUser(result.user);
}

export async function signInWithEmail(email: string, password: string) {
  const data = await apiRequest<AuthResponse>('/auth/login', { method: 'POST', authenticated: false, body: { email: email.trim(), password } });
  await storeSession(data);
  return data;
}

export async function signUpWithEmail(input: { email: string; password: string; timezone: string }) {
  const data = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST', authenticated: false, body: { email: input.email.trim(), password: input.password, timezone: input.timezone },
  });
  await storeSession(data);
  return data;
}

export async function exportAccountData() { return (await apiRequest<{ export: Record<string, unknown> }>('/auth/export')).export; }

export async function updateAccountEmail(email: string, currentPassword: string) {
  const result = await apiRequest<{ user: Profile }>('/auth/email', { method: 'PATCH', body: { email: email.trim(), currentPassword } });
  return mergeStoredUser(result.user);
}

export async function changeAccountPassword(currentPassword: string, newPassword: string) {
  await apiRequest<{ ok: true }>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
  await storeSession(null);
}

export async function signOutAllDevices() {
  await apiRequest<{ ok: true }>('/auth/sign-out-all', { method: 'POST' });
  await storeSession(null);
}

export async function deleteAccount(password: string) {
  await apiRequest<void>('/auth/account', { method: 'DELETE', body: { password } });
  await storeSession(null);
}

export async function sendPasswordReset(email: string) {
  return apiRequest<{ ok: true; developmentToken?: string }>('/auth/password-reset/request', { method: 'POST', authenticated: false, body: { email: email.trim() } });
}

export async function confirmPasswordReset(token: string, password: string) {
  return apiRequest<{ ok: true }>('/auth/password-reset/confirm', { method: 'POST', authenticated: false, body: { token: token.trim(), password } });
}

export async function signOut() {
  const existing = getStoredSession();
  try {
    if (existing?.refreshToken) {
      await apiRequest<void>('/auth/logout', { method: 'POST', authenticated: false, body: { refreshToken: existing.refreshToken } });
    }
  } finally { await storeSession(null); }
}
