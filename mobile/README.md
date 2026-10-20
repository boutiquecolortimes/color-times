# Color Times — Mobile (React Native CLI · iOS + Android)

One premium app for every role, talking to the same Next.js backend as the web admin (repo root).

| Role | What they get |
|---|---|
| **Customer** | Onboarding, editorial home, collections, search & filters, dress pages with date availability, "Request this dress" (lands in staff **Enquiries** + push), wishlist, my bookings with status timeline, bills (PDF), reviews, addresses, **Color Times Privé** membership |
| **Staff** | Dashboard, bookings (create, confirm → pickup → return, cancel, reminders, review requests), catalogue (add with camera/gallery upload, availability, duplicate), invoices (payments, WhatsApp send, PDF, refunds), sales, customisation, dry clean & tailor, customers, reviews, reports, enquiries, notifications, trash restore, global search |
| **Admin** | Everything above, plus edits, deletes, team logins, staff & salary, expenses, purchases, profit & loss |
| **Developer / Super Admin** | Everything, plus WhatsApp inbox/stats and business settings |

Permissions mirror `lib/auth/roles.ts`; the API enforces them, the app only hides what a role can't do.

---

Full page-by-page mapping to the website and web admin: **[PARITY.md](./PARITY.md)**.

## 1. Prerequisites (macOS)

- Node ≥ 22.11, Watchman (`brew install watchman`)
- **Android:** Android Studio, JDK 17, an emulator or a phone with USB debugging
- **iOS:** Xcode 16+, CocoaPods (`sudo gem install cocoapods` or `bundle install`)

## 2. Install

```bash
cd mobile
npm install
cd ios && bundle install && bundle exec pod install && cd ..   # iOS only
```

## 3. Run (debug)

Start the backend from the repo root (`npm run dev`, port 3000), then:

```bash
cd mobile
npm start                 # Metro
npm run android           # Gradle build + install on emulator/device
npm run ios               # Xcode build + simulator
```

The app points at `http://10.0.2.2:3000` (Android emulator) or `http://localhost:3000` (iOS simulator).
On a **real phone**, tap **Server** at the bottom of the sign-in screen (debug builds only) and enter your Mac's LAN IP, e.g. `http://192.168.1.20:3000`.

Sign in with any existing account. Staff/admins land in the ERP, customers in the boutique app.

## 4. Before the first release

1. **API URL** — set `PRODUCTION_API_URL` in `src/config.ts` to the live site.
2. **App icons & splash**: the branded ones are already in place (CT monogram). To change them, replace `android/app/src/main/res/mipmap-*`, `drawable-*/splash_*` and `ios/ColorTimes/Images.xcassets/{AppIcon.appiconset,LaunchLogo.imageset}`.
3. **Push notifications (Firebase Cloud Messaging)**
   - Create a Firebase project → add Android app `com.colortimes.boutique` → put `google-services.json` in `android/app/`.
   - Add iOS app `com.colortimes.boutique` → put `GoogleService-Info.plist` in `ios/ColorTimes/` and add it to the Xcode target.
   - Upload your APNs key in Firebase → Project settings → Cloud Messaging.
   - In Xcode → Signing & Capabilities add **Push Notifications** and **Background Modes → Remote notifications**.
   - Backend: set `FIREBASE_SERVICE_ACCOUNT` (service-account JSON) in the web app's environment.
   - Without these files the app still builds and runs — push is simply off.
4. **Color Times Privé subscription (RevenueCat)**
   - Create the subscription products in App Store Connect and Google Play Console (e.g. `prive_monthly`, `prive_yearly`).
   - In RevenueCat: add both apps, an entitlement **`prive`**, and an offering with monthly/annual packages.
   - Put the public SDK keys in `REVENUECAT_KEYS` in `src/config.ts`.
   - Webhook: RevenueCat → Integrations → Webhooks → `https://<site>/api/webhooks/revenuecat`, Authorization = `REVENUECAT_WEBHOOK_SECRET` (set the same value in the web app's env).
   - Until keys are set, the paywall shows "Memberships open soon" instead of a buy button.
   - The perk copy in `src/lib/purchases.ts` (trial fitting, member offers) is placeholder text — confirm with the boutique before launch. "Early access" (7 days) is enforced by the server.

## 5. Release builds

**Android (Play Store, Gradle):**

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore colortimes-upload.keystore -alias colortimes -keyalg RSA -keysize 2048 -validity 10000
```

Add to `~/.gradle/gradle.properties` (never commit):

```
COLORTIMES_UPLOAD_STORE_FILE=/absolute/path/colortimes-upload.keystore
COLORTIMES_UPLOAD_STORE_PASSWORD=...
COLORTIMES_UPLOAD_KEY_ALIAS=colortimes
COLORTIMES_UPLOAD_KEY_PASSWORD=...
```

```bash
cd android
./gradlew bundleRelease     # → app/build/outputs/bundle/release/app-release.aab (upload to Play Console)
./gradlew assembleRelease   # → APK for direct install/testing
```

Bump `versionCode` / `versionName` in `android/app/build.gradle` for every upload.

**iOS (App Store):** open `ios/ColorTimes.xcworkspace` → select your team under Signing → Product → Archive → Distribute.

## 6. Project layout

```
mobile/
  App.tsx                    providers (query client, auth, toasts, dialogs)
  src/config.ts              API URL, RevenueCat keys, brand
  src/theme/                 colours, fonts (Cormorant Garamond + Manrope), spacing
  src/api/                   fetch client (Bearer + silent refresh), React Query hooks, types
  src/auth/AuthContext.tsx   sign-in/up, keychain tokens, biometric lock, push + purchases wiring
  src/components/ui/         design system (Button, Card, Sheet, ListScreen, forms, toasts…)
  src/components/admin/      pickers, payment sheet, summary strip
  src/navigation/            role-based stacks + floating tab bar
  src/screens/auth/          onboarding, login, register, lock
  src/screens/admin/         every ERP module
  src/screens/customer/      boutique app + Privé paywall
  src/screens/shared/        account
```

## 7. Backend changes this app relies on

All in the repo root, backwards-compatible with the web admin:

- `lib/auth/session.ts` — accepts `Authorization: Bearer <access token>` in addition to the cookie, so every existing `/api/admin/*` route works from the app.
- `/api/auth/login`, `/register`, `/refresh`, `/api/admin/account/password` — return tokens in the body **only** when the request carries `x-client: color-times-mobile`.
- New: `/api/mobile/*` (home, products, me, my bookings, wishlist, enquiries, push-token), `/api/admin/enquiries`, `/api/admin/bill-number`, `/api/webhooks/revenuecat`.
- `User` gains `premium` and `pushTokens`; in-app notifications are mirrored as FCM pushes.
- `/api/mobile/content` serves the website copy (About, Offers, FAQ, Journal, Terms, Privacy, Contact) from `lib/mobile/site-content.ts` — **if you edit that text on the website pages, update this file too**.
- `GET /api/reviews/[token]` (for the native review screen) and `/api/admin/bill-number`, `/api/admin/enquiries`.
- `GET /api/admin/bookings/[id]` also returns the booking's `review` (or null).
- `/bill/[id]/hi`: public Hindi bill page. It has the same exposure as `/api/invoices/[id]/pdf`: anyone with the invoice id can open it. It builds the Hindi PDF in the browser with `buildInvoicePdf()` from `lib/admin/invoice-pdf.ts`. `lib/admin/invoice-pdf-data.ts` loads the invoice for both the English PDF route and this page.

## Parity status (re-audit, Oct 2026)

Everything on the web admin and website is in the app; see PARITY.md. These were added in the latest pass:
- Bookings: deposit badge and the web's money columns (`src/lib/bookingMoney.ts`, a port of `lib/admin/booking-status.ts`, so keep the two in step); booked dresses are greyed out in the booking form; each returned dress has "Send to dry clean"; dress photo viewer.
- Walk-in quick-add customer (no email, S/O·D/O·W/O) on the booking, sale and customisation forms.
- Categories as a full list (bulk delete, Trash, export); bulk delete on invoices and sales; a view of deleted customisation and service orders (view only, no restore, matching the web).
- Inline rent edit in the catalogue; change a service order's status from the list; copy a temporary password.
- WhatsApp: Meta sent/delivered chart and a webhook setup card. Legacy `brevoTemplateId` is kept when you save.
- Explore: recent searches and collection descriptions.
- Print: list exports and invoice, sale and customisation bills open in the system PDF viewer, which prints.
- Not done: light theme. The app is dark only.

Second re-audit (Oct 2026):
- Empty Trash in the global Trash and in each list's Trash; the global Trash gets search and paging.
- Import template download for customers and products.
- Hindi invoice PDF via `/bill/[id]/hi`. Hindi needs a browser canvas, so the app opens that page in the phone's browser.
- Invoice stage badge and "Generated at" history.
- The customer's review shown on the booking page.
- Analytics monthly table; photos from a link; WhatsApp language picker, raw JSON and QR copy link.
- Branded icons and splash on both platforms; shimmer skeletons; motion polish; Android pinch zoom.

## Design system & themes (Oct 2026 redesign)

- **Light (Luxury Ivory), Dark (Midnight Luxury) and System**, under Account → Appearance. The choice is saved, applied instantly, and keyboards, date pickers and Android night resources follow it. Full token table, rules and components: **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)**.
- Text/surface contrast is enforced by `__tests__/theme.test.ts` (WCAG AA). Theme switching and persistence are covered by `__tests__/ThemeProvider.test.tsx`, and a both-theme render smoke test by `__tests__/components.smoke.test.tsx`.
- Dashboard: Business pulse for Today / This week / This month (rent booked, collected, outstanding; costs and net profit for managers), straight from the Reports API.
- Progress steps on bookings, stitching and service orders, with an Overdue flag on late services.
- Customer profile: outstanding balance, upcoming pickups and returns, and a Measurement book (by wearer, newest first, compare with the previous visit).
- Accessibility: 48pt icon touch areas, readable screen-reader labels, tab roles on chips and segments, honours Reduce Motion.
- Layout fix: pressables now carry their own layout. Segmented controls, quick-create and "today" tiles had been collapsing to their content width.
- Visual QA harness for real screens in both themes: `tools/visual-qa`.

## Checks

```bash
npx tsc --noEmit     # types
npx eslint .         # lint
npx jest             # unit tests
```
