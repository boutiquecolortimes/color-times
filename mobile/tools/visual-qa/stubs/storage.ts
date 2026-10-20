// Theme preference comes from the URL (?scheme=light|dark) so each screenshot is deterministic.
const scheme = new URLSearchParams(location.search).get('scheme') ?? 'dark';
export const prefs = {
  get: async (k: string) => (k === 'themeMode' ? scheme : null),
  set: async () => undefined,
  remove: async () => undefined,
};
export const tokens = { get: async () => null, set: async () => undefined, clear: async () => undefined };
export const biometryType = async () => null;
export const enableBiometricLock = async () => false;
export const disableBiometricLock = async () => undefined;
export const biometricUnlock = async () => false;
export const saveTokens = async () => undefined;
export const loadTokens = async () => null;
export const clearTokens = async () => undefined;
export const unlockWithBiometrics = async () => false;
