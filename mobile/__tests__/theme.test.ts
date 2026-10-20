import { StyleSheet } from 'react-native';
import {
  alpha,
  applyScheme,
  colors,
  currentScheme,
  gradients,
  palettes,
  themed,
  type Palette,
  type Scheme,
} from '../src/theme';
import { parseThemeMode, resolveScheme } from '../src/theme/mode';

// ---- WCAG contrast -----------------------------------------------------------

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16))
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SCHEMES: Scheme[] = ['light', 'dark'];
const BACKGROUNDS: (keyof Palette)[] = ['bg', 'bgElevated', 'surface'];
// Body-size text: WCAG AA 4.5:1 on every background it's placed on.
const BODY_TEXT: (keyof Palette)[] = [
  'text',
  'textMuted',
  'textFaint',
  'gold',
  'success',
  'warning',
  'danger',
  'info',
  'rose',
];

describe.each(SCHEMES)('%s palette contrast', (scheme) => {
  const p = palettes[scheme];

  it.each(BODY_TEXT)('%s meets AA (4.5:1) on bg, elevated and surface', (token) => {
    for (const bg of BACKGROUNDS) {
      expect(contrast(p[token], p[bg])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('primary text is comfortable (≥ 7:1) on the page', () => {
    expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(7);
  });

  it('text on accent fills (buttons, active tabs) meets AA', () => {
    expect(contrast(p.onGold, p.gold)).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text still reads on pressed / selected surfaces', () => {
    expect(contrast(p.textMuted, p.surfaceHigh)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.text, p.accentBg)).toBeGreaterThanOrEqual(7);
  });

  it('borders are visible against cards (non-text ≥ 1.2:1) without shouting', () => {
    const r = contrast(p.borderStrong, p.surface);
    expect(r).toBeGreaterThanOrEqual(1.2);
    expect(r).toBeLessThan(3.5);
  });
});

// ---- Mode resolution & persistence parsing -------------------------------

describe('theme mode', () => {
  it('defaults to System for anything unknown', () => {
    expect(parseThemeMode(null)).toBe('system');
    expect(parseThemeMode(undefined)).toBe('system');
    expect(parseThemeMode('sepia')).toBe('system');
  });

  it('round-trips stored choices', () => {
    for (const m of ['system', 'light', 'dark'] as const) expect(parseThemeMode(m)).toBe(m);
  });

  it('explicit choices ignore the OS; System follows it', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    // Unknown OS appearance → the brand's dark default.
    expect(resolveScheme('system', null)).toBe('dark');
  });
});

// ---- Live tokens -----------------------------------------------------------

describe('live tokens', () => {
  afterAll(() => applyScheme('dark'));

  it('applyScheme swaps colours and gradients in place', () => {
    applyScheme('light');
    expect(currentScheme()).toBe('light');
    expect(colors.bg).toBe(palettes.light.bg);
    expect(gradients.gold[1]).toBe(palettes.light.gold);
    applyScheme('dark');
    expect(colors.bg).toBe(palettes.dark.bg);
  });

  it('themed() styles are rebuilt after a scheme change and cached otherwise', () => {
    let builds = 0;
    const styles = themed(() => {
      builds += 1;
      return StyleSheet.create({ card: { backgroundColor: colors.surface } });
    });
    applyScheme('dark');
    expect(styles.card.backgroundColor).toBe(palettes.dark.surface);
    expect(styles.card.backgroundColor).toBe(palettes.dark.surface);
    expect(builds).toBe(1);
    applyScheme('light');
    expect(styles.card.backgroundColor).toBe(palettes.light.surface);
    expect(builds).toBe(2);
    // Spreading (used by some style arrays) sees the current values too.
    expect({ ...styles }.card.backgroundColor).toBe(palettes.light.surface);
  });

  it('alpha() derives translucent colours from tokens', () => {
    expect(alpha('#C4A675', 0.1)).toBe('rgba(196,166,117,0.1)');
    expect(alpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)');
    expect(alpha('rgba(20,21,18,0.6)', 0)).toBe('rgba(20,21,18,0)');
  });

  it('both palettes define every token', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });
});
