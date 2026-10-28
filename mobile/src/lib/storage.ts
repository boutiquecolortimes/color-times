import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

/** Refresh + access tokens live in the iOS Keychain / Android Keystore. */
const TOKEN_SERVICE = 'com.colortimes.boutique.session';
/** A separate biometric-protected item: reading it is what triggers Face ID / fingerprint. */
const LOCK_SERVICE = 'com.colortimes.boutique.lock';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword('session', JSON.stringify(tokens), {
    service: TOKEN_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const result = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
    if (!result) return null;
    const parsed = JSON.parse(result.password) as Partial<StoredTokens>;
    return parsed.accessToken && parsed.refreshToken
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
      : null;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
}

// ---- Biometric app lock ---------------------------------------------------

export async function biometryType(): Promise<string | null> {
  try {
    return await Keychain.getSupportedBiometryType();
  } catch {
    return null;
  }
}

export async function enableBiometricLock(): Promise<boolean> {
  try {
    const result = await Keychain.setGenericPassword('lock', 'on', {
      service: LOCK_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!result) return false;
    await prefs.set('biometricLock', '1');
    return true;
  } catch {
    return false;
  }
}

export async function disableBiometricLock(): Promise<void> {
  await Keychain.resetGenericPassword({ service: LOCK_SERVICE });
  await prefs.remove('biometricLock');
}

/** Shows the system Face ID / Touch ID / fingerprint prompt. */
export async function unlockWithBiometrics(): Promise<boolean> {
  try {
    const result = await Keychain.getGenericPassword({
      service: LOCK_SERVICE,
      authenticationPrompt: { title: 'Unlock Color Times', cancel: 'Cancel' },
    });
    return Boolean(result);
  } catch {
    return false;
  }
}

// ---- Plain preferences ----------------------------------------------------

type PrefKey =
  | 'onboarded'
  | 'biometricLock'
  | 'mpinLock'
  | 'mpinOffered'
  | 'apiUrl'
  | 'pushToken'
  | 'recentSearches'
  | 'themeMode'
  | 'lastActive';

export const prefs = {
  async get(key: PrefKey): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(`ct.${key}`);
    } catch {
      return null;
    }
  },
  async set(key: PrefKey, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`ct.${key}`, value);
    } catch {
      // non-critical
    }
  },
  async remove(key: PrefKey): Promise<void> {
    try {
      await AsyncStorage.removeItem(`ct.${key}`);
    } catch {
      // non-critical
    }
  },
};
