/**
 * Booking money rules — a straight port of the web's `lib/admin/booking-status.ts`
 * so every number in the app matches the web admin, invoices and exports.
 * Keep the two files in step.
 */
import { fmtDate, inr } from './format';
import type { Tone } from './labels';

interface MoneyFields {
  status?: string;
  totalAmount: number;
  securityDeposit: number;
  advancePaid?: number;
  pickupPaid?: number;
  damageCharges?: number;
  depositRefundAmount?: number;
  depositRefunded?: boolean;
  depositRefundedAt?: string | null;
}

export function bookingRent(b: Pick<MoneyFields, 'totalAmount' | 'securityDeposit'>): number {
  return Math.max(0, b.totalAmount - b.securityDeposit);
}

/** Still owed. After return, unpaid rent + damage is first taken from the deposit. */
export function bookingRemainingDue(b: MoneyFields): number {
  const rent = bookingRent(b);
  const paid = Math.max(0, b.advancePaid ?? 0);
  if (b.status !== 'returned') return Math.max(0, rent - paid);
  return Math.max(0, rent + (b.damageCharges ?? 0) - paid - bookingDepositUsed(b));
}

/** Part of the deposit kept for rent/damage at return. */
export function bookingDepositUsed(b: MoneyFields): number {
  if (b.status !== 'returned') return 0;
  return Math.max(0, b.securityDeposit - (b.depositRefundAmount ?? 0));
}

/** Deposit money physically still with the boutique. */
export function bookingDepositHeld(b: MoneyFields): number {
  if (b.status === 'cancelled') return 0;
  if (b.status === 'returned') return b.depositRefunded ? 0 : Math.max(0, b.depositRefundAmount ?? 0);
  const paidBeyondRent = Math.max(0, (b.advancePaid ?? 0) - bookingRent(b));
  return Math.min(b.securityDeposit, paidBeyondRent);
}

export type DepositState = 'none' | 'not_collected' | 'held' | 'refund_pending' | 'refunded' | 'kept';

export function bookingDepositState(b: MoneyFields): DepositState {
  if (b.securityDeposit <= 0 || b.status === 'cancelled') return 'none';
  if (b.status === 'returned') {
    if ((b.depositRefundAmount ?? 0) <= 0) return 'kept';
    return b.depositRefunded ? 'refunded' : 'refund_pending';
  }
  return bookingDepositHeld(b) > 0 ? 'held' : 'not_collected';
}

export const DEPOSIT_STATE: Record<Exclude<DepositState, 'none'>, { label: string; tone: Tone }> = {
  not_collected: { label: 'Deposit not collected', tone: 'muted' },
  held: { label: 'Deposit held', tone: 'info' },
  refund_pending: { label: 'Refund pending', tone: 'warning' },
  refunded: { label: 'Deposit refunded', tone: 'success' },
  kept: { label: 'Kept for rent/damage', tone: 'muted' },
};

/** "Refunded ₹2,000 on 12 Oct 2026" — badge detail and exports. */
export function depositStateText(b: MoneyFields): string {
  const state = bookingDepositState(b);
  if (state === 'none') return '';
  if (state === 'refunded') {
    const amount = inr(b.depositRefundAmount ?? 0);
    return b.depositRefundedAt
      ? `Refunded ${amount} on ${fmtDate(b.depositRefundedAt)}`
      : `Refunded ${amount}`;
  }
  if (state === 'refund_pending') return `Refund pending · ${inr(b.depositRefundAmount ?? 0)}`;
  return DEPOSIT_STATE[state].label;
}

/** Paid split: advance (before pickup), rent paid at pickup, security on top. Rent is paid first. */
export function bookingPaidBreakdown(b: MoneyFields): {
  advance: number;
  duePaid: number;
  securityHeld: number;
} {
  const rent = bookingRent(b);
  const totalPaid = Math.max(0, b.advancePaid ?? 0);
  const pickup = Math.min(totalPaid, Math.max(0, b.pickupPaid ?? 0));
  const advance = totalPaid - pickup;
  const duePaid = Math.min(pickup, Math.max(0, rent - advance));
  return { advance, duePaid, securityHeld: Math.max(0, totalPaid - rent) };
}
