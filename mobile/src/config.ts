import { Platform } from 'react-native';

/**
 * Where the app's data comes from: the Color Times Next.js site (this repo's
 * root). The app has no backend of its own - it calls the same /api routes as
 * the web portal, on the live site, with the same MongoDB behind them.
 *
 * LIVE_API_URL is used by every build. For local backend work, set
 * USE_LOCAL_BACKEND = true (debug builds only) to call your own `npm run dev`
 * instead; the emulator reaches your Mac at 10.0.2.2. Debug builds can also
 * switch at runtime from the sign-in screen -> "Server".
 */
export const LIVE_API_URL = 'https://colortimesboutique.com';

const USE_LOCAL_BACKEND = false;

export const LOCAL_API_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

/** Debug builds pre-fill this email on the sign-in screen (never a password). Release builds start empty. */
export const DEV_LOGIN_EMAIL = 'owner@colortimesboutique.com';

export const DEFAULT_API_URL = __DEV__ && USE_LOCAL_BACKEND ? LOCAL_API_URL : LIVE_API_URL;

/**
 * RevenueCat public SDK keys for the "Color Times Privé" subscription
 * (RevenueCat dashboard → Project → API keys). Leave empty to hide purchase
 * buttons — the paywall then explains that membership is coming soon.
 */
export const REVENUECAT_KEYS = {
  ios: '',
  android: '',
};

/** RevenueCat entitlement identifier that unlocks Privé. */
export const PREMIUM_ENTITLEMENT = 'prive';

export const BRAND = {
  name: 'Color Times',
  fullName: 'Color Times Boutique',
  /** The website's tagline (lib/config/site.ts). */
  tagline: 'Wear the Moment',
  phone: '',
  whatsapp: '',
};
