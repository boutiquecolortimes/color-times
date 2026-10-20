# Web ↔ Mobile parity checklist

Every page of the Next.js app (`app/**/page.tsx`) and every API action the web admin calls, mapped to where it lives in the app. ✅ = in the app.

## Admin (staff / admin / developer / super admin)

| Web page / feature | Mobile |
|---|---|
| `/admin` dashboard — KPIs, today, revenue chart, recent bookings, attention cards | ✅ Today tab |
| Dashboard analytics panel — status/invoice breakdowns, revenue by category, top 5 dresses, 12-month trend + monthly detail table, date presets + custom range | ✅ Analytics |
| Global search | ✅ Search (dashboard 🔍) |
| Notification bell — list, mark read, mark all read | ✅ Notifications (+ push) |
| `/admin/bookings` — status tabs + counts, search, date range, sort, money summary, deposit-state badge (held / refund pending / refunded / kept), bulk delete, Trash restore/permanent, export CSV/Excel/PDF/Print with the web's money columns | ✅ Bookings |
| Booking calendar view | ✅ Booking calendar |
| `/admin/bookings/new` & `/[id]/edit` — customer picker + walk-in quick-add (no email, S/O·D/O·W/O), bill no. suggestion, dates, dresses already booked for those dates greyed out, multi-dress lines with live availability, wearer + measurements, advance + method | ✅ Booking form |
| `/admin/bookings/[id]` — confirm / pickup / return / cancel dialogs, invoice sync, remind, review request, refund deposit, undo return, per-dress "Send to dry clean" after return, dress photo viewer, customer review (stars, comment, photos), delete, change history | ✅ Booking detail |
| `/admin/bookings/settings` — payment methods | ✅ Business settings |
| `/admin/products` — grid, search, status & category filters, favourites, inline rent edit, archived view, bulk activate/hide/archive/delete, Trash, import, export, duplicate | ✅ Catalogue |
| `/admin/products/new`, `/[id]` — photos (camera / gallery / paste a link), all fields, costs (managers), sizes/stock, visibility, deposit/retail defaults from settings | ✅ Product form |
| Product drawer — gallery viewer, set cover photo, availability calendar & checker, performance, booking/service history, change history | ✅ Product detail |
| `/admin/products/settings` — inventory settings (threshold, code prefix, multipliers, auto-archive) | ✅ Business settings |
| `/admin/categories` — CRUD, cover image (upload or link), featured, order, sort, bulk delete, Trash + Empty Trash, export | ✅ Categories |
| `/admin/customers` — search, sort, bulk, Trash, import (with downloadable template), export | ✅ Customers |
| `/admin/customers/new`, `/[id]` — profile, bookings, call/WhatsApp, edit, archive/unarchive, delete, history | ✅ |
| `/admin/invoices` — status & type tabs, search, sort, bulk delete, Trash, export | ✅ Billing tab |
| `/admin/invoices/new` — manual or from booking; edit drafts | ✅ Invoice form |
| `/admin/invoices/[id]` — English **and Hindi (हिंदी)** PDF, share/print, stage badge + "Generated at" stage history, payments, send, remind, refund deposit, cancel, delete, history | ✅ Invoice detail |
| `/admin/sales` (+ new, edit, detail) — payment tabs, summary, date range, walk-in quick-add, bulk delete, Trash, export, collect payment, send bill, PDF/print, history | ✅ Sales |
| `/admin/customisation` (+ new, edit) — status flow, measurements, walk-in quick-add, payments, send, PDF/print, date range, deleted-records view, export, history | ✅ Customisation |
| `/admin/services` — dry clean / tailor, status flow + inline status change from the list, multi-dress create, linked to booking, edit, deleted-records view, export, history | ✅ Dry clean & tailor |
| `/admin/reviews` — rating filter, search, photos | ✅ Reviews |
| `/admin/reports` — every report type, presets + custom range, status / service filters, return reminders, export | ✅ Reports |
| `/admin/users` (Team) — role/status filters, create with temp password (copy/share), edit role/active, reset password, remove | ✅ Team |
| `/admin/staff` — staff CRUD, salary payments (create/edit/delete, month/staff filters), bulk, Trash, export | ✅ Staff & salary |
| `/admin/expenses` — category filter, CRUD, bulk, Trash, export | ✅ Expenses |
| `/admin/purchases` (+ new) — single purchase CRUD, **dealer parcel** with new/restock lines, bulk, Trash, export | ✅ Purchases |
| `/admin/whatsapp` — overview & setup checklist, account health, phone numbers, Meta sent/delivered chart, webhook setup (callback URL copy, verify-token check, recent calls), subscribe app, inbox with media, send any template, Meta templates (create/delete/sync), automations + test send, settings, business profile, QR codes, delivery logs | ✅ WhatsApp |
| `/admin/trash` — all entities, search, paging, restore, delete forever, **Empty Trash** | ✅ Trash (+ per-list Trash with Empty Trash) |
| `/admin/account` — profile, password | ✅ Account (+ Face ID lock) |
| Enquiries from the website contact form & app | ✅ Enquiries (new) |

## Portal menu → app (Oct 2026 menu audit)

The app's **More** tab lists the portal sidebar in the same groups and order (`lib/config/admin-nav.ts`), with the same role rules. It also has the top-bar items.

| Portal group | Menu items | App |
|---|---|---|
| Overview | Dashboard (+ analytics, search, notifications in the top bar) | Dashboard tab · More → Overview |
| Inventory | Categories, Products (+ Inventory settings, developer / super admin) | Products tab · More → Inventory |
| Rentals | Bookings, Reviews, Sale, Dry Clean & Tailor, Customisation (+ Booking settings) | Bookings tab · More → Rentals (also Booking calendar, Enquiries) |
| Billing | Invoices, Reports | Invoices tab · More → Billing |
| People | Customers, Team (managers) | More → People |
| Finance | Staff, Expenses, Purchases (managers) | More → Finance |
| Marketing | WhatsApp (developer / super admin) | More → Marketing |
| Top bar | Account settings, Trash, View website (locked except developer), Log out, theme | More → Account · Account → Appearance |

Tab names now match the portal's mobile bottom bar: Dashboard · Bookings · Products · Invoices · More.

Also aligned in this audit:
- Every list has the portal's sort options.
- Bulk delete on invoices and sales.
- Sale detail shows the rental-settlement badge, with no Collect payment on settlements, and taps through to the dress.
- Cancel booking has the no-refund policy (English and Hindi) and a "customer has been told" confirmation.
- Settings entry points are restricted to developer / super admin, as on the portal.

## Logic-level audit (Oct 2026, second pass)

Checked beyond labels:
- every portal form field against the app's data;
- every dialog description, warning and policy text;
- every portal action (mutation);
- every query parameter in both directions;
- every route the app navigates to;
- the portal's background behaviour.

Fixed in this pass:
- **Return confirmed:** after a return, the app shows the settlement (pending amount, refund due or refunded) and offers to open the invoice, as the portal does.
- **WhatsApp failures:** failed sends and test messages show Meta's full error response (copyable). Template sync shows "Check these after syncing" warnings. The template form explains the PDF-header rule and the one-active-template-per-event rule.
- **Live refresh, like the portal:** WhatsApp inbox every 15 s, open chat every 10 s, notifications every 30 s. It pauses while the app is in the background.
- **8-hour idle sign-out** for staff and admin accounts (customers stay signed in), matching the portal's session rule.
- **Inventory report status filter:** now Active / Archived / Trash. It had been sending dress statuses, which the report ignored.
- **"Last month to date"** preset added on Reports and Analytics.



| Web page | Mobile |
|---|---|
| `/login`, `/register` | ✅ (+ onboarding) |
| `/verify-email` | ✅ verify banner + resend; link opens in browser |
| `/home` — hero (Explore collection / Book an appointment), collections, trending, designers, stats, why us, process, testimonials, FAQ, gallery | ✅ Home |
| `/collections`, `/collections/[slug]` (with collection description) | ✅ Collections, Explore (+ recent searches) |
| `/offers` | ✅ Offers |
| `/gallery` | ✅ Gallery |
| `/about` | ✅ About |
| `/testimonials` | ✅ Testimonials |
| `/blog`, `/blog/[slug]` | ✅ Journal |
| `/contact` (form + details) | ✅ Contact |
| `/faq` | ✅ FAQ |
| `/order-tracking` | ✅ Track a booking (also before sign-in) |
| `/terms`, `/privacy-policy` | ✅ Legal |
| `/account` — my bookings | ✅ My bookings |
| `/wishlist` | ✅ Wishlist |
| `/review/[token]` — stars, comment, 1–4 photos | ✅ Native review |
| `/site-locked` | n/a (web-only gate while the site is in progress) |

## Printing
Every list export and every bill (invoice, sale, customisation) has **Print**: the app builds or downloads the PDF and opens the system viewer (iOS Quick Look / Android PDF app), which has the Print button — the phone equivalent of the web's print buttons.

## WhatsApp details
Create-template language picker (English / US / UK, Hindi, Gujarati, Marathi, Punjabi), Meta template raw JSON (view + copy), QR "Copy link".

## Look & feel (iOS + Android)
- Branded app icon: gold "CT" monogram on warm ink. Single 1024 universal icon on iOS; adaptive icon on Android with a monochrome layer for Android 13 themed icons.
- Branded launch screen on both: iOS storyboard; Android 12+ system splash plus a pre-12 launch theme.
- Shimmer skeletons instead of spinners everywhere (lists, grids, details, dashboard).
- Content fades and lifts in on every screen. The gold tab pill blooms in.
- A haptic plays with every success or error toast.
- Android text is trimmed of font padding, so headings sit true.
- Full-screen photo viewer with pinch or double-tap zoom on both platforms, including the customer dress page.

## Not in the app
- **Light theme** — the app is dark ("atelier noir") only; the web admin also has a light mode.

## App-only extras
Privé membership (App Store / Play subscription), dress requests → staff enquiries with push, biometric lock, push notifications, haptics, offline-friendly caching.
