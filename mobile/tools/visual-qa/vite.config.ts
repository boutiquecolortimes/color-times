import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const H = __dirname;
// The app being rendered (two levels up: mobile/).
const M = path.resolve(H, '../..');
const stub = (f: string) => path.join(H, 'stubs', f);
const nativeOnly = [
  'react-native-haptic-feedback', 'react-native-keychain', 'react-native-blob-util', 'react-native-share',
  '@react-native-documents/picker', '@react-native-firebase/app', '@react-native-firebase/messaging',
  'react-native-purchases', 'react-native-image-picker', '@react-native-clipboard/clipboard',
  '@react-native-async-storage/async-storage',
];

// Metro's `require('./x.png')` -> an RN-web image source the browser can load.
const rnImages = {
  name: 'rn-image-require',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!/\.(tsx?|jsx?)$/.test(id) || !code.includes('.png')) return null;
    let n = 0;
    const imports: string[] = [];
    const out = code.replace(/require\((['"])([^'"]+\.png)\1\)/g, (_m, _q, p) => {
      const v = `__rnimg${n++}`;
      imports.push(`import ${v} from ${JSON.stringify(p)};`);
      return `{ uri: ${v} }`;
    });
    return n ? { code: imports.join('\n') + '\n' + out, map: null } : null;
  },
};

export default defineConfig({
  root: H,
  plugins: [rnImages, react({ include: /\.(tsx?|jsx?)$/ })],
  define: { __DEV__: 'true', 'process.env.NODE_ENV': '"development"', global: 'globalThis' },
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.jsx', '.mjs', '.json'],
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^react$/, replacement: path.join(H, 'node_modules/react') },
      { find: /^react\/(.*)$/, replacement: path.join(H, 'node_modules/react/$1') },
      { find: /^react-dom$/, replacement: path.join(H, 'node_modules/react-dom') },
      { find: /^react-dom\/(.*)$/, replacement: path.join(H, 'node_modules/react-dom/$1') },
      { find: /^react-native$/, replacement: path.join(H, 'node_modules/react-native-web') },
      { find: /^react-native-linear-gradient$/, replacement: path.join(H, 'node_modules/react-native-web-linear-gradient') },
      { find: /^@react-native-community\/datetimepicker$/, replacement: stub('datetimepicker.js') },
      ...nativeOnly.map((m) => ({ find: new RegExp(`^${m.replace('/', '\\/')}$`), replacement: stub('native.js') })),
      { find: /^(\.\.\/)+auth\/AuthContext$/, replacement: stub('auth.tsx') },
      { find: /^(\.\.\/)+api\/client$/, replacement: stub('client.ts') },
      { find: /^\.\/client$/, replacement: stub('client.ts') },
      { find: /^\.\/storage$/, replacement: stub('storage.ts') },
      { find: /^(\.\.\/)+lib\/storage$/, replacement: stub('storage.ts') },
      { find: /^(\.\.\/)+lib\/push$/, replacement: stub('native.js') },
      { find: /^(\.\.\/)+lib\/purchases$/, replacement: stub('native.js') },
      { find: /^react-native-svg$/, replacement: stub('svg.tsx') },
      { find: /^@react-native\/assets-registry\/registry$/, replacement: stub('registry.js') },
      { find: /^@app\/(.*)$/, replacement: `${M}/src/$1` },
      ...['@tanstack/react-query', '@react-navigation/native', '@react-navigation/native-stack', 'react-native-safe-area-context'].map(
        (m) => ({ find: new RegExp(`^${m.replace('/', '\\/')}$`), replacement: `${M}/node_modules/${m}` })
      ),
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react-native', 'react-native-svg'],
    esbuildOptions: { resolveExtensions: ['.web.js', '.js', '.ts', '.tsx'], loader: { '.js': 'jsx' } },
  },
  server: { fs: { allow: [H, M] }, port: 5173 },
});
