import { AccessibilityInfo } from 'react-native';

/**
 * Honour the system "Reduce Motion" setting: decorative motion (screen
 * reveal, tab pill bloom, skeleton shimmer) is skipped when it's on.
 */
let reduced = false;
const listeners = new Set<(v: boolean) => void>();

AccessibilityInfo.isReduceMotionEnabled()
  .then((v) => {
    reduced = v;
    listeners.forEach((l) => l(v));
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
  reduced = v;
  listeners.forEach((l) => l(v));
});

export function reduceMotion(): boolean {
  return reduced;
}

export function onReduceMotionChange(fn: (v: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
