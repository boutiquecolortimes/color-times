import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { applyScheme, palettes, type Scheme } from '../src/theme';

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), canGoBack: () => true }),
}));
jest.mock('../src/api/client', () => ({
  api: { url: (p: string) => p, get: jest.fn() },
  errorMessage: String,
}));
jest.mock('../src/lib/storage', () => ({ prefs: { get: jest.fn(), set: jest.fn() } }));
jest.mock('../src/auth/AuthContext', () => ({ useRole: () => 'admin', useAuth: () => ({}) }));
jest.mock('react-native-share', () => ({ open: jest.fn() }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@react-native-documents/picker', () => ({}));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-native-image-picker', () => ({}));
jest.mock('react-native-svg', () => new Proxy({}, { get: () => 'Svg' }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => 'LucideIcon' }));

const ui = require('../src/components/ui');

function flatColors(style: unknown, out: Set<string>) {
  let flat: Record<string, unknown> | undefined;
  try {
    flat = StyleSheet.flatten(style as never) as Record<string, unknown> | undefined;
  } catch {
    return;
  }
  for (const [k, v] of Object.entries(flat ?? {})) {
    if (/color$/i.test(k) && typeof v === 'string') out.add(v);
  }
}

describe.each(['light', 'dark'] as Scheme[])('shared components render in %s', (scheme) => {
  beforeAll(() => applyScheme(scheme));
  afterAll(() => applyScheme('dark'));

  it('renders and only uses the active palette for text and surfaces', async () => {
    let root!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      root = ReactTestRenderer.create(
        <>
          <ui.T variant="h1">Title</ui.T>
          <ui.Card>
            <ui.KV label="Rent" value="₹12,500" />
            <ui.Pill label="Confirmed" tone="gold" />
            <ui.ListRow title="Priya Sharma" subtitle="#00881" icon="CalendarCheck" />
          </ui.Card>
          <ui.Button title="Save" onPress={() => undefined} />
          <ui.Button title="Delete" variant="danger" onPress={() => undefined} />
          <ui.IconButton icon="Share2" onPress={() => undefined} />
          <ui.ProgressSteps
            steps={[
              { key: 'a', label: 'Booked' },
              { key: 'b', label: 'Confirmed' },
              { key: 'c', label: 'Picked up' },
            ]}
            current="b"
          />
          <ui.Empty title="Nothing here yet" />
          <ui.Loading variant="list" />
          <ui.Segmented
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ]}
            value="a"
            onChange={() => undefined}
          />
        </>
      );
    });
    const used = new Set<string>();
    root.root.findAll(() => true).forEach((n) => flatColors(n.props?.style, used));
    const other: Scheme = scheme === 'light' ? 'dark' : 'light';
    // Core text/background tokens of the *other* palette must not leak in.
    for (const key of ['bg', 'surface', 'text', 'textMuted'] as const) {
      expect(used.has(palettes[other][key])).toBe(false);
    }
    expect(used.has(palettes[scheme].text)).toBe(true);
    // The icon button got a readable screen-reader label.
    const labels = root.root.findAll((n) => n.props?.accessibilityLabel === 'Share');
    expect(labels.length).toBeGreaterThan(0);
  });
});
