import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, api } from '../api/client';
import type { SessionUser, UserRole } from '../api/types';
import { prefs, unlockWithBiometrics } from '../lib/storage';
import { registerForPush, unregisterPush } from '../lib/push';
import { configurePurchases, resetPurchases } from '../lib/purchases';
import { queryClient } from '../api/queryClient';
import { idleExpired } from '../lib/session';
import { toast } from '../components/ui/Toast';
import { clearMpin, hasMpin, verifyMpin, type MpinCheck } from '../lib/mpin';

interface AuthTokensResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'locked' | 'signedIn';
  user: SessionUser | null;
  onboarded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Face ID / fingerprint. */
  unlock: () => Promise<boolean>;
  /** MPIN unlock. Too many wrong PINs signs out (attemptsLeft 0). */
  unlockWithPin: (pin: string) => Promise<MpinCheck>;
  /** True right after a password sign-in when no MPIN is set yet: offer to create one. */
  mpinOffer: boolean;
  dismissMpinOffer: () => void;
  finishOnboarding: () => Promise<void>;
  /** After a password change the server issues a new token pair. */
  replaceTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64url → UTF-8 string (no atob dependency). */
function base64UrlDecode(input: string): string {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = B64.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

function decodeJwt(token: string): SessionUser | null {
  try {
    const json = JSON.parse(base64UrlDecode(token.split('.')[1]));
    return {
      sub: json.sub,
      name: json.name,
      email: json.email,
      role: json.role,
    };
  } catch {
    return null;
  }
}

/** Locks again after the app has been in the background this long. */
const RELOCK_AFTER_MS = 2 * 60 * 1000;

/**
 * The server returns tokens in the body only to the mobile app. A server that
 * predates the mobile changes sets a browser cookie instead, which the app
 * can't use - say so plainly rather than failing on the next call.
 */
function requireAppTokens(data: AuthTokensResponse | null | undefined): void {
  if (!data?.accessToken || !data?.refreshToken) {
    throw new ApiError(
      `${api.baseUrl} hasn't been updated for the mobile app yet. Deploy the latest backend, then try again.`,
      200
    );
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const userRef = useRef<SessionUser | null>(null);
  userRef.current = user;
  const signOutRef = useRef<(() => Promise<void>) | null>(null);
  const [mpinOffer, setMpinOffer] = useState(false);

  const afterSignIn = useCallback(async (session: SessionUser) => {
    setUser(session);
    setStatus('signedIn');
    configurePurchases(session.sub);
    registerForPush();
  }, []);

  // Boot: restore the session from the keychain.
  useEffect(() => {
    (async () => {
      const [stored, onboardedFlag, lockFlag, lastActive, pinFlag] = await Promise.all([
        api.init(),
        prefs.get('onboarded'),
        prefs.get('biometricLock'),
        prefs.get('lastActive'),
        prefs.get('mpinLock'),
      ]);
      setOnboarded(onboardedFlag === '1');
      const session = stored ? decodeJwt(stored.accessToken) : null;
      if (!session) {
        setStatus('signedOut');
        return;
      }
      if (idleExpired(session.role, lastActive ? Number(lastActive) : null)) {
        await api.post('/api/auth/logout').catch(() => {});
        await api.setTokens(null);
        setStatus('signedOut');
        // after the toast host has mounted
        setTimeout(
          () => toast.info('Signed out', 'You were inactive for 8 hours. Please sign in again.'),
          800
        );
        return;
      }
      prefs.set('lastActive', String(Date.now()));
      setUser(session);
      if (lockFlag === '1' || pinFlag === '1') {
        setStatus('locked');
      } else {
        await afterSignIn(session);
      }
    })();
  }, [afterSignIn]);

  // Session revoked server-side (password changed elsewhere, account deactivated).
  useEffect(() => {
    const unsubscribe = api.onSessionEnded(() => {
      queryClient.clear();
      setUser(null);
      setStatus('signedOut');
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Re-lock with biometrics after time in the background.
  useEffect(() => {
    let backgroundedAt = 0;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
        prefs.set('lastActive', String(backgroundedAt));
      }
      if (state === 'active' && backgroundedAt) {
        if (idleExpired(userRef.current?.role, backgroundedAt) && api.hasSession()) {
          await signOutRef.current?.();
          toast.info('Signed out', 'You were inactive for 8 hours. Please sign in again.');
          return;
        }
        prefs.set('lastActive', String(Date.now()));
        if (Date.now() - backgroundedAt > RELOCK_AFTER_MS) {
          const locks = await Promise.all([prefs.get('biometricLock'), prefs.get('mpinLock')]);
          if (locks.includes('1') && api.hasSession()) setStatus('locked');
        }
      }
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<AuthTokensResponse>('/api/auth/login', {
        email,
        password,
      });
      requireAppTokens(data);
      await api.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      await afterSignIn({
        sub: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
      });
      if (!(await hasMpin()) && (await prefs.get('mpinOffered')) !== '1') setMpinOffer(true);
    },
    [afterSignIn]
  );

  const register = useCallback(
    async (input: { name: string; email: string; phone?: string; password: string }) => {
      const data = await api.post<AuthTokensResponse>('/api/auth/register', input);
      requireAppTokens(data);
      await api.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      await afterSignIn({
        sub: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
      });
    },
    [afterSignIn]
  );

  const signOut = useCallback(async () => {
    // The MPIN unlocks this session only; the next sign-in sets up its own.
    await clearMpin();
    setMpinOffer(false);
    await unregisterPush();
    await resetPurchases();
    await api.post('/api/auth/logout').catch(() => {});
    await api.setTokens(null);
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, []);
  signOutRef.current = signOut;

  const unlock = useCallback(async () => {
    const ok = await unlockWithBiometrics();
    if (ok && user) await afterSignIn(user);
    return ok;
  }, [afterSignIn, user]);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      const result = await verifyMpin(pin);
      if (result.ok) {
        if (user) await afterSignIn(user);
      } else if (result.attemptsLeft === 0) {
        await signOutRef.current?.();
        toast.info('Signed out', 'Too many wrong MPINs. Sign in with your password.');
      }
      return result;
    },
    [afterSignIn, user]
  );

  const dismissMpinOffer = useCallback(() => {
    setMpinOffer(false);
    prefs.set('mpinOffered', '1');
  }, []);

  const finishOnboarding = useCallback(async () => {
    await prefs.set('onboarded', '1');
    setOnboarded(true);
  }, []);

  const replaceTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    await api.setTokens({ accessToken, refreshToken });
    const session = decodeJwt(accessToken);
    if (session) setUser(session);
  }, []);

  const refreshUser = useCallback(() => {
    api
      .get<{ me: { name: string } }>('/api/mobile/me')
      .then(({ me }) => setUser((current) => (current ? { ...current, name: me.name } : current)))
      .catch(() => {});
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      onboarded,
      signIn,
      register,
      signOut,
      unlock,
      unlockWithPin,
      mpinOffer,
      dismissMpinOffer,
      finishOnboarding,
      replaceTokens,
      refreshUser,
    }),
    [
      status,
      user,
      onboarded,
      signIn,
      register,
      signOut,
      unlock,
      unlockWithPin,
      mpinOffer,
      dismissMpinOffer,
      finishOnboarding,
      replaceTokens,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function useRole(): UserRole | null {
  return useAuth().user?.role ?? null;
}
