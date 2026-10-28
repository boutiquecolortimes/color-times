// Theme preference comes from the URL (?scheme=light|dark) so each screenshot is deterministic.
const q = new URLSearchParams(location.search);
const scheme = q.get('scheme') ?? 'dark';
// ?mpin=1 / ?bio=1 turn on the MPIN / biometric lock for lock-screen shots.
const flags: Record<string, string | null> = {
  themeMode: scheme,
  mpinLock: q.get('mpin') === '1' ? '1' : null,
  biometricLock: q.get('bio') === '1' ? '1' : null,
};
export const prefs = {
  get: async (k: string) => flags[k] ?? null,
  set: async () => undefined,
  remove: async () => undefined,
};
export const tokens = { get: async () => null, set: async () => undefined, clear: async () => undefined };
export const biometryType = async () => (q.get('bio') === '1' ? 'FaceID' : null);
export const enableBiometricLock = async () => false;
export const disableBiometricLock = async () => undefined;
export const biometricUnlock = async () => false;
export const saveTokens = async () => undefined;
export const loadTokens = async () => null;
export const clearTokens = async () => undefined;
export const unlockWithBiometrics = async () => false;
