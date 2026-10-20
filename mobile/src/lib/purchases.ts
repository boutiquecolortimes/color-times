import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { PREMIUM_ENTITLEMENT, REVENUECAT_KEYS } from '../config';

/**
 * Color Times Privé — the in-app subscription, sold through the App Store and
 * Google Play via RevenueCat. The server (api/webhooks/revenuecat) is the
 * source of truth for who is a member; the SDK here only runs the purchase
 * sheet and gives instant feedback right after buying.
 */
let configured = false;

export function purchasesAvailable(): boolean {
  return Boolean(Platform.OS === 'ios' ? REVENUECAT_KEYS.ios : REVENUECAT_KEYS.android);
}

export async function configurePurchases(userId: string): Promise<void> {
  if (!purchasesAvailable()) return;
  try {
    if (!configured) {
      Purchases.configure({
        apiKey: Platform.OS === 'ios' ? REVENUECAT_KEYS.ios : REVENUECAT_KEYS.android,
        appUserID: userId,
      });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
  } catch {
    // Never block sign-in on the store.
  }
}

export async function resetPurchases(): Promise<void> {
  if (!configured) return;
  await Purchases.logOut().catch(() => {});
}

export interface PlanOption {
  id: string;
  title: string;
  price: string;
  period: 'monthly' | 'yearly' | 'other';
  pkg: PurchasesPackage;
}

export async function loadPlans(): Promise<PlanOption[]> {
  if (!configured) return [];
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return [];
  return current.availablePackages.map((pkg) => {
    const type = String(pkg.packageType);
    const period = type === 'ANNUAL' ? 'yearly' : type === 'MONTHLY' ? 'monthly' : 'other';
    return {
      id: pkg.identifier,
      title: period === 'yearly' ? 'Annual' : period === 'monthly' ? 'Monthly' : pkg.product.title,
      price: pkg.product.priceString,
      period,
      pkg,
    };
  });
}

/** Returns true when the purchase unlocked the entitlement. Throws on store errors (not on user cancel). */
export async function buyPlan(plan: PlanOption): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT]);
  } catch (error) {
    if ((error as { userCancelled?: boolean })?.userCancelled) return false;
    throw error;
  }
}

export async function restorePlan(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  return Boolean(info.entitlements.active[PREMIUM_ENTITLEMENT]);
}

export const PRIVE_PERKS = [
  {
    icon: 'Sparkles',
    title: 'First look at new arrivals',
    body: 'See every new couture piece 7 days before anyone else.',
  },
  {
    icon: 'Crown',
    title: 'Priority requests',
    body: 'Your dress requests jump the queue — the atelier calls you first.',
  },
  {
    icon: 'Shirt',
    title: 'Complimentary trial',
    body: 'Book an in-store trial fitting before your event, on us.',
  },
  {
    icon: 'Gift',
    title: 'Member-only offers',
    body: 'Seasonal privileges and festival previews, reserved for Privé.',
  },
] as const;
