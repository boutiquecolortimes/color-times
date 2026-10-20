import { trigger } from 'react-native-haptic-feedback';

type Kind = 'tap' | 'select' | 'success' | 'error' | 'warning' | 'heavy';

const MAP = {
  tap: 'impactLight',
  select: 'selection',
  success: 'notificationSuccess',
  error: 'notificationError',
  warning: 'notificationWarning',
  heavy: 'impactMedium',
} as const;

export function haptic(kind: Kind = 'tap'): void {
  try {
    trigger(MAP[kind], { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  } catch {
    // haptics are decoration
  }
}
