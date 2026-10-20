# Color Times design system (mobile)

Quiet luxury: warm paper or warm charcoal, one bronze/champagne accent, editorial serif
headings (Cormorant Garamond) over a clean sans (Manrope). Every screen uses semantic tokens,
so it works in both themes without special cases.

## Themes

| | Luxury Ivory (light) | Midnight Luxury (dark) |
|---|---|---|
| `bg` page | `#F7F4EE` | `#141512` |
| `bgElevated` sheets, dialogs | `#FBF9F5` | `#191A17` |
| `surface` cards, inputs | `#FFFFFF` | `#1D1F1B` |
| `surfaceHigh` pressed / selected / nested | `#F1ECE3` | `#262822` |
| `border` / `borderStrong` | `#E5E0D7` / `#D3CBBD` | `#34362F` / `#45473F` |
| `text` | `#22231F` | `#F4F1EA` |
| `textMuted` | `#64635C` | `#B0B0A7` |
| `textFaint` captions, meta | `#6E6C65` | `#94948A` |
| `textDisabled` | `#A9A69D` | `#62635B` |
| `gold` brand accent | `#7A6239` (bronze) | `#C4A675` (champagne) |
| `goldBright` / `goldDeep` | `#9C8052` / `#5F4C2C` | `#DCC08F` / `#8F7748` |
| `onGold` text on accent fills | `#FFFFFF` | `#1B1810` |
| `accentBg` accent wash | `#EDE4D5` | `#353024` |
| `success` `warning` `danger` `info` `rose` | `#2B7149` `#8A5E00` `#B3261E` `#2F5D8A` `#9A4F43` | `#7DBA8C` `#E0B35C` `#E58A7E` `#8FB0D4` `#D39A8B` |
| `successBg` … `infoBg` | 8–10% washes | 14% washes |
| `overlay` / `scrim` / `viewer` | modal backdrop / icon chip on photos / photo viewer | — |

The light accent is a touch deeper than the brief's `#8B7045`, because `#8B7045` is only
4.25:1 on ivory. `#7A6239` passes AA as body text.

**Contrast is tested.** `__tests__/theme.test.ts` fails the build if any body-text token
(`text`, `textMuted`, `textFaint`, `gold`, the status colours) falls below **4.5:1** on `bg`,
`bgElevated` or `surface`, in either theme. It also requires primary text to be ≥ 7:1 and text
on accent fills to be ≥ 4.5:1.

Gradients (`gradients.*`) follow the theme too:
- `gold` is the primary button.
- `veil` fades a photo into the page.
- `shade` darkens the top of a photo so header icons stay legible.
- `prive` is the membership card and dashboard hero.
- `ink` is the auth / onboarding wash.

## Using tokens

```tsx
import { alpha, colors, gradients, radius, space, themed } from '../theme';

// Inline: read at render time, so it follows the theme automatically.
<View style={{ backgroundColor: colors.surface, borderColor: colors.border }} />

// Module-level sheets must be wrapped, or they'd freeze the colours from app launch:
const styles = themed(() =>
  StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: radius.lg } })
);

// Translucent variants come from tokens, never literals:
backgroundColor: alpha(colors.gold, 0.08)
```

Rules:
- **No colour literals in components.** The three remaining ones are deliberate and commented: the fabric colours in the onboarding artwork, the white quiet zone behind WhatsApp QR codes, and WhatsApp's brand green in its delivery chart.
- **Status is never colour alone.** Pills always carry a label, progress steps carry ticks and names, and overdue items carry the word "Overdue".
- **Text on photos:** use the `veil` gradient (fades to the page, so normal text tokens work), or `onImage` with `shade`. Brand marks over photos use `<Monogram onImage />`.

## Theme engine

- `src/theme/index.ts`: palettes, live `colors`, `gradients` and `shadow`; `applyScheme()`, `themed()`, `alpha()`, plus the type scale, spacing and radii.
- `src/theme/ThemeProvider.tsx` and `useTheme()`: Light / Dark / System.
  - The choice is saved on the device (`prefs.themeMode`) and restored before the first frame.
  - It's mirrored to the OS with `Appearance.setColorScheme`, so keyboards, date pickers and Android night resources match.
  - A switch applies immediately. The UI remounts (`key={scheme}`) while navigation state, auth and cached data are kept.
- The setting lives under **Account → Appearance** for every role.
- Native: iOS no longer forces Dark in `Info.plist`. Android's window colour comes from `values/` and `values-night/` `app_bg`. The splash and launch screen stay brand ink in both themes.
- `src/lib/motion.ts` follows the system Reduce Motion setting. When it's on, the screen reveal, tab-pill bloom, press scale and skeleton shimmer are all skipped.

## Type

| Variant | Font / size | Use |
|---|---|---|
| `hero` | Cormorant SemiBold 40 | editorial headlines |
| `h1` / `h2` / `h3` | Cormorant 32 / 25 / 20 | screen and section titles, names, amounts |
| `number` | Cormorant 28 | KPI values |
| `body` / `bodyStrong` | Manrope 15 | content |
| `small` / `smallStrong` | Manrope 13 | secondary lines |
| `caption` | Manrope Medium 11, uppercase, +1.4 tracking | section labels |

Text scales with the user's font size up to 1.4×. On Android, font padding is trimmed so serif headings sit true.

## Spacing & shape

The spacing scale is `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 28 · xxxl 40` (an 8-pt rhythm with half-steps). The page gutter is 16.

Radii are `sm 8 · md 12 · lg 18 · xl 26 · pill`. Cards use `lg`, sheets use `xl`, and buttons and chips use `pill`.

Elevation is one `shadow` token: a soft brown shadow in light, deeper in dark, elevation 3 / 6 on Android.

## Components (`src/components/ui`)

| Component | Notes |
|---|---|
| `T` | Text with the variants above. `gold`, `muted` and `color` props. |
| `Button` | Variants `gold` (primary), `outline`, `ghost` (accent-coloured text), `surface`, `danger`. Sizes `sm`/`md`/`lg`. |
| `IconButton` | 40pt visual, ≥ 48pt touch area. Falls back to a readable label (e.g. "Share"). |
| `Tap` | Every pressable. Layout styles apply to the pressable itself, with a spring scale (off under Reduce Motion), a haptic and `accessibilityState`. |
| `Card`, `Section`, `ListRow`, `KV`, `Pill`, `Divider`, `Empty`, `ErrorState` | Layout and content primitives. |
| `Loading` | Shimmer skeleton shaped like the content (`detail` / `hero` / `list` / `grid` / `stats`). A label switches to a spinner. |
| `ProgressSteps` | Booking / stitching / service progress. Ticks, current ring, labels and an accessible summary; a cancelled state shows instead of steps. |
| `Input`, `MoneyInput`, `DateField`, `SelectField`, `SearchBar`, `ToggleRow`, `Chips`, `Segmented` | Forms. Chips and Segmented expose tab roles and selected state. Keyboard and date picker follow the theme. |
| `Sheet`, `confirm()` dialog, `toast` | Bottom sheets, confirmations (destructive ones are red with a warning haptic), and toasts (with success/error haptics). |
| `Bars`, `Stat`, `MonthCalendar` | Charts and KPIs in accent tones that work on both themes. |
| `ImageViewer` | Full-screen photos. Pinch and double-tap zoom on iOS and Android. |
| `ListScreen` | Search, chips, filters, bulk select, Trash, export and print for every admin list. |

## Visual QA

`tools/visual-qa` renders the real screens in Chromium (react-native-web) with fixture data, in both themes. See its README. Screens checked so far:
- Dashboard
- Bookings list
- Booking detail
- Customer profile
- Account
- Customer home
- Dress page

A final pass on physical iOS and Android devices is still needed for anything native: shadows, keyboard, safe areas, system sheets and haptics.
