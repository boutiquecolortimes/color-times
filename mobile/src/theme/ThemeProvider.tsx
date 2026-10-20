import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, StatusBar, View } from 'react-native';
import { prefs } from '../lib/storage';
import { applyScheme, colors, palettes, type Scheme } from './index';
import { parseThemeMode, resolveScheme, type ThemeMode } from './mode';

export { THEME_MODES, type ThemeMode } from './mode';

interface ThemeValue {
  /** What the user picked. */
  mode: ThemeMode;
  /** What's on screen. */
  scheme: Scheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue>({ mode: 'system', scheme: 'dark', setMode: () => undefined });

const systemScheme = () => Appearance.getColorScheme();

/**
 * Owns the Light / Dark / System preference.
 *  • Persists the explicit choice and restores it on launch (before the app draws).
 *  • Mirrors it into the OS (`Appearance.setColorScheme`) so keyboards, date
 *    pickers, alerts and the Android night resources match.
 *  • Swaps the live tokens and remounts the UI (`key={scheme}`); navigation
 *    state, auth and cached data survive the switch.
 */
export function ThemeProvider({ children }: { children: (scheme: Scheme) => React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode | null>(null);
  const [system, setSystem] = useState(systemScheme);
  const modeRef = useRef<ThemeMode>('system');

  useEffect(() => {
    let alive = true;
    prefs.get('themeMode').then((raw) => {
      if (!alive) return;
      const m = parseThemeMode(raw);
      modeRef.current = m;
      if (m !== 'system') Appearance.setColorScheme(m);
      setModeState(m);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (modeRef.current === 'system') setSystem(colorScheme);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    modeRef.current = m;
    Appearance.setColorScheme(m === 'system' ? 'auto' : m);
    if (m === 'system') setSystem(systemScheme());
    setModeState(m);
    prefs.set('themeMode', m);
  }, []);

  const scheme = resolveScheme(mode ?? 'system', system);
  // Swap tokens synchronously, before any child reads them this render.
  applyScheme(scheme);

  const value = useMemo(() => ({ mode: mode ?? 'system', scheme, setMode }), [mode, scheme, setMode]);

  if (mode === null) {
    // Preference not read yet (a few ms): hold a blank frame in the expected
    // background instead of drawing the wrong theme and flipping.
    return <View style={{ flex: 1, backgroundColor: palettes[scheme].bg }} />;
  }

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} animated />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>{children(scheme)}</View>
    </ThemeContext.Provider>
  );
}

/** Current theme + setter, for the Appearance setting and theme-aware code. */
export function useTheme(): ThemeValue & { colors: typeof colors } {
  return { ...useContext(ThemeContext), colors };
}
