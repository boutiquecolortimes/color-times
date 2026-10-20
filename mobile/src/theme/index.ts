import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Color Times design tokens.
 *
 * Two palettes share one set of semantic names, so components never ask
 * "am I in dark mode?" — they ask for `colors.surface`, `colors.textMuted`…
 *
 *  • Luxury Ivory (light) — warm paper, ink type, a bronze accent.
 *  • Midnight Luxury (dark) — warm charcoal, soft ivory type, champagne gold.
 *
 * Every text/surface pairing is checked against WCAG AA in
 * __tests__/theme.test.ts. The token names are historical: `gold` is the
 * brand accent in both palettes (bronze on ivory, champagne on midnight).
 *
 * `colors`, `gradients` and `shadow` are live objects: ThemeProvider swaps
 * their contents when the scheme changes, then re-renders the app. Styles
 * that read tokens must therefore be evaluated at render time — inline, or
 * through `themed(() => StyleSheet.create({...}))` for module-level sheets.
 */

export type Scheme = 'light' | 'dark';

export interface Palette {
  /** App background. */
  bg: string;
  /** Sheets, dialogs, raised bars. */
  bgElevated: string;
  /** Cards, inputs, list tiles. */
  surface: string;
  /** Pressed / selected / nested surfaces. */
  surfaceHigh: string;
  border: string;
  borderStrong: string;

  text: string;
  textMuted: string;
  /** Tertiary text: captions, meta. Still AA on bg and surface. */
  textFaint: string;
  /** Disabled controls and placeholder text. */
  textDisabled: string;

  /** Brand accent (text, icons, fills). */
  gold: string;
  /** Lighter accent, used for highlights and gradient tops. */
  goldBright: string;
  /** Deeper accent, used for rings, dashed outlines and gradient bottoms. */
  goldDeep: string;
  /** Text / icons placed on an accent fill. */
  onGold: string;
  /** Soft accent wash behind accent content (selected chips, banners). */
  accentBg: string;

  rose: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** 10–14% washes of the status colours for pill / banner backgrounds. */
  successBg: string;
  warningBg: string;
  dangerBg: string;
  infoBg: string;

  /** Modal / sheet backdrop. */
  overlay: string;
  /** Translucent chip behind icons laid over photos. */
  scrim: string;
  /** Text on top of photographs (always light — photos are darkened by the veil). */
  onImage: string;
  /** Floating tab bar fill. */
  tabBar: string;
  /** Shimmer highlight swept across skeletons. */
  sheen: string;
  /** Photo-viewer backdrop. */
  viewer: string;
  transparent: string;
}

export const palettes: Record<Scheme, Palette> = {
  light: {
    bg: '#F7F4EE',
    bgElevated: '#FBF9F5',
    surface: '#FFFFFF',
    surfaceHigh: '#F1ECE3',
    border: '#E5E0D7',
    borderStrong: '#D3CBBD',

    text: '#22231F',
    textMuted: '#64635C',
    textFaint: '#6E6C65',
    textDisabled: '#A9A69D',

    gold: '#7A6239',
    goldBright: '#9C8052',
    goldDeep: '#5F4C2C',
    onGold: '#FFFFFF',
    accentBg: '#EDE4D5',

    rose: '#9A4F43',
    success: '#2B7149',
    warning: '#8A5E00',
    danger: '#B3261E',
    info: '#2F5D8A',
    successBg: 'rgba(43,113,73,0.10)',
    warningBg: 'rgba(138,94,0,0.10)',
    dangerBg: 'rgba(179,38,30,0.08)',
    infoBg: 'rgba(47,93,138,0.10)',

    overlay: 'rgba(34,35,31,0.42)',
    scrim: 'rgba(20,21,18,0.42)',
    onImage: '#FFFFFF',
    tabBar: 'rgba(255,255,255,0.97)',
    sheen: 'rgba(139,112,69,0.10)',
    viewer: '#0B0B0A',
    transparent: 'transparent',
  },
  dark: {
    bg: '#141512',
    bgElevated: '#191A17',
    surface: '#1D1F1B',
    surfaceHigh: '#262822',
    border: '#34362F',
    borderStrong: '#45473F',

    text: '#F4F1EA',
    textMuted: '#B0B0A7',
    textFaint: '#94948A',
    textDisabled: '#62635B',

    gold: '#C4A675',
    goldBright: '#DCC08F',
    goldDeep: '#8F7748',
    onGold: '#1B1810',
    accentBg: '#353024',

    rose: '#D39A8B',
    success: '#7DBA8C',
    warning: '#E0B35C',
    danger: '#E58A7E',
    info: '#8FB0D4',
    successBg: 'rgba(125,186,140,0.14)',
    warningBg: 'rgba(224,179,92,0.14)',
    dangerBg: 'rgba(229,138,126,0.14)',
    infoBg: 'rgba(143,176,212,0.14)',

    overlay: 'rgba(6,6,5,0.72)',
    scrim: 'rgba(8,8,7,0.55)',
    onImage: '#FFFFFF',
    tabBar: 'rgba(29,31,27,0.97)',
    sheen: 'rgba(220,192,143,0.09)',
    viewer: '#000000',
    transparent: 'transparent',
  },
};

export interface Gradients {
  /** Accent fill for primary buttons and quick actions. */
  gold: string[];
  /** Page wash behind hero sections. */
  ink: string[];
  /** Photo → page background fade (hero images, cards). */
  veil: string[];
  /** Top-of-photo shade so header icons stay legible. */
  shade: string[];
  card: string[];
  /** Privé membership card. */
  prive: string[];
}

const gradientSets: Record<Scheme, Gradients> = {
  light: {
    gold: ['#9C8052', '#7A6239', '#5F4C2C'],
    ink: ['#FFFFFF', '#F7F4EE'],
    veil: ['rgba(247,244,238,0)', 'rgba(247,244,238,0.6)', 'rgba(247,244,238,0.97)'],
    shade: ['rgba(20,21,18,0.45)', 'rgba(20,21,18,0)'],
    card: ['#FFFFFF', '#FAF7F1'],
    prive: ['#EDE4D5', '#F7F1E6'],
  },
  dark: {
    gold: ['#E3CB9C', '#C4A675', '#8F7748'],
    ink: ['#22241F', '#141512'],
    veil: ['rgba(20,21,18,0)', 'rgba(20,21,18,0.55)', 'rgba(20,21,18,0.96)'],
    shade: ['rgba(20,21,18,0.6)', 'rgba(20,21,18,0)'],
    card: ['#23251F', '#1A1C18'],
    prive: ['#3A3326', '#1F201B'],
  },
};

const shadowSets: Record<Scheme, ViewStyle> = {
  light: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#3B3226',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 3 },
  }),
  dark: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    default: { elevation: 6 },
  }),
};

// ---- live token objects (contents swapped by applyScheme) -----------------

let current: Scheme = 'dark';
let version = 0;

export const colors: Palette = { ...palettes.dark };
export const gradients: Gradients = { ...gradientSets.dark };
export const shadow: ViewStyle = { ...shadowSets.dark };

/** Swap every live token to `scheme`. Returns true when something changed. */
export function applyScheme(scheme: Scheme): boolean {
  if (scheme === current && version > 0) return false;
  current = scheme;
  version += 1;
  Object.assign(colors, palettes[scheme]);
  Object.assign(gradients, gradientSets[scheme]);
  for (const key of Object.keys(shadow)) delete (shadow as Record<string, unknown>)[key];
  Object.assign(shadow, shadowSets[scheme]);
  return true;
}

export function currentScheme(): Scheme {
  return current;
}

export function themeVersion(): number {
  return version;
}

/**
 * Module-level styles that depend on tokens: `const styles = themed(() =>
 * StyleSheet.create({...}))`. The factory re-runs once per theme change and
 * the result is cached, so `styles.foo` costs a property read as before.
 */
export function themed<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let at = -1;
  const get = (): T => {
    if (!cache || at !== version) {
      cache = factory();
      at = version;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (get() as Record<string | symbol, unknown>)[key],
    has: (_t, key) => key in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Object.getOwnPropertyDescriptor(get(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/** Token colour at an opacity: `alpha(colors.gold, 0.1)`. Accepts #rgb, #rrggbb or rgba(). */
export function alpha(color: string, a: number): string {
  if (color.startsWith('rgba(')) {
    return color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${a})`);
  }
  let hex = color.replace('#', '');
  if (hex.length === 3)
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

// ---- type, space, radius ---------------------------------------------------

export const fonts = {
  display: 'CormorantGaramond-SemiBold',
  displayMedium: 'CormorantGaramond-Medium',
  displayBold: 'CormorantGaramond-Bold',
  body: 'Manrope-Regular',
  bodyMedium: 'Manrope-Medium',
  bodySemi: 'Manrope-SemiBold',
  bodyBold: 'Manrope-Bold',
} as const;

/** 8-point rhythm (with 2/4/12/20 half-steps for fine alignment). */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;

export type TypeVariant =
  | 'hero'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption'
  | 'number';

export const type: Record<TypeVariant, TextStyle> = themed(() => ({
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.text, letterSpacing: 0.2 },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.text },
  h2: { fontFamily: fonts.display, fontSize: 25, lineHeight: 30, color: colors.text },
  h3: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  smallStrong: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.text },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  number: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.text },
}));

/** Extra touch area so 36–40pt icons still meet the 44pt target. */
export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
