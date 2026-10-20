import React from 'react';
import { Appearance, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { colors, palettes } from '../src/theme';
import { ThemeProvider, useTheme, type ThemeMode } from '../src/theme/ThemeProvider';

// In-memory prefs instead of AsyncStorage.
const store: Record<string, string> = {};
jest.mock('../src/lib/storage', () => ({
  prefs: {
    get: jest.fn(async (k: string) => store[k] ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
  },
}));

let api: ReturnType<typeof useTheme> | null = null;
function Probe() {
  api = useTheme();
  return <Text>{`${api.mode}:${api.scheme}:${colors.bg}`}</Text>;
}

async function mount() {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    root = ReactTestRenderer.create(<ThemeProvider>{() => <Probe />}</ThemeProvider>);
  });
  // let the stored preference resolve
  await act(async () => undefined);
  return root;
}

const text = (root: ReactTestRenderer.ReactTestRenderer) =>
  root.root.findByType(Text).props.children as string;

describe('ThemeProvider', () => {
  let setScheme: jest.SpyInstance;
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    setScheme = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined);
    api = null;
  });
  afterEach(() => jest.restoreAllMocks());

  it('first launch follows the system appearance', async () => {
    const root = await mount();
    expect(text(root)).toBe(`system:light:${palettes.light.bg}`);
  });

  it('restores a saved explicit choice and tells the OS', async () => {
    store.themeMode = 'dark';
    const root = await mount();
    expect(text(root)).toBe(`dark:dark:${palettes.dark.bg}`);
    expect(setScheme).toHaveBeenCalledWith('dark');
  });

  it('switching applies immediately, persists, and System releases the override', async () => {
    const root = await mount();
    for (const [mode, scheme] of [
      ['dark', 'dark'],
      ['light', 'light'],
      ['system', 'light'],
    ] as [ThemeMode, string][]) {
      await act(async () => api!.setMode(mode));
      expect(text(root)).toBe(`${mode}:${scheme}:${palettes[scheme as 'light' | 'dark'].bg}`);
      expect(store.themeMode).toBe(mode);
    }
    expect(setScheme).toHaveBeenLastCalledWith('auto');
  });
});
