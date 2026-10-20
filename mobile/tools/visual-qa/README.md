# Visual QA harness

Renders the **real** app screens (not mock-ups) in a browser through react-native-web, with
fixture data, in **Light** and **Dark**, and saves 390-pt-wide screenshots to `shots/`.

```bash
cd mobile/tools/visual-qa
npm install
npm run dev &               # Vite on :5173
npm run shoot               # → shots/<screen>-<light|dark>.png
# CHROME_PATH=/path/to/chrome npm run shoot   (if Playwright's browser isn't installed)
```

- Screens: `dashboard, bookings, booking, customer, account, home, dress`. Add more in `src/main.tsx`.
- Data: `src/fixtures.ts` (long names, large ₹ amounts, missing fields on purpose).
- Native-only modules (keychain, haptics, push, purchases, file pickers) are inert stubs in `stubs/`;
  `react-native-svg` is mapped to plain DOM SVG.

**Limits:** this is the web renderer. Fonts, layout and colours match closely, but it is not a
substitute for a final pass on an iPhone and an Android phone (native shadows, blur, keyboard,
safe areas, system dialogs, haptics). Warnings about nested `<button>` are web-only.
