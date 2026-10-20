import "server-only";

export interface PremiumState {
  isActive: boolean;
  plan: string | null;
  expiresAt: string | null;
}

/** Normalises the stored membership, treating a lapsed expiry as inactive. */
export function premiumStateOf(premium?: {
  isActive?: boolean;
  plan?: string;
  expiresAt?: Date | null;
} | null): PremiumState {
  if (!premium?.isActive) return { isActive: false, plan: null, expiresAt: null };
  const expiresAt = premium.expiresAt ? new Date(premium.expiresAt) : null;
  const isActive = !expiresAt || expiresAt.getTime() > Date.now();
  return {
    isActive,
    plan: isActive ? premium.plan ?? null : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}

/**
 * Members-only perks, enforced server-side where they touch data. Keep in
 * sync with mobile/src/lib/premium.ts (which drives the paywall copy).
 */
export const PREMIUM_PERKS = {
  /** New arrivals are visible to members this many days before everyone else. */
  earlyAccessDays: 7,
} as const;
