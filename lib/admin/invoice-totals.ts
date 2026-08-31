// Splits an invoice's outstanding balance into what's actually still owed
// for the rent vs. the security deposit sitting with the business.
//
// Why this exists: `total` (and therefore `amountDue`) includes the security
// deposit for any booking that hasn't been returned yet, so a plain "Due"
// figure silently blends "the customer still owes rent" with the deposit
// into one number. The deposit itself is never treated as still owed here —
// it's almost always collected in cash at pickup and kept at the counter
// rather than logged as an invoice payment the moment it changes hands, so
// there's no reliable way to tell "collected but not logged" apart from
// "genuinely outstanding" from the payment records alone. Labeling it "due"
// in that gap reads as a debt the customer still owes, when in practice
// it's simply being held pending the dress's return — so it's always shown
// as held, never due. Splitting it out also lets the UI show the real rent
// balance on its own.
export interface InvoiceDueBreakdownInput {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  securityDeposit: number;
  total: number;
  amountPaid: number;
}

export interface InvoiceDueBreakdown {
  /** Rent + tax − discount, excluding the security deposit entirely. */
  rentTotal: number;
  /**
   * How much of `total` is currently the security deposit. This is 0 once a
   * booking has been returned/settled (the deposit is resolved outside the
   * invoice at that point via the return flow), otherwise it equals
   * `securityDeposit`.
   */
  securityInTotal: number;
  /** What's still owed for the rent itself. */
  rentDue: number;
  /**
   * The security deposit portion still sitting with the business, not yet
   * refunded. Same value as `securityInTotal` — kept as its own field so
   * call sites read "held", not "due", at the point of use.
   */
  securityHeld: number;
}

export function getInvoiceDueBreakdown(invoice: InvoiceDueBreakdownInput): InvoiceDueBreakdown {
  const rentTotal = Math.max(0, invoice.subtotal - invoice.discountAmount + invoice.taxAmount);
  const securityInTotal = Math.max(0, invoice.total - rentTotal);
  const paidTowardRent = Math.min(Math.max(0, invoice.amountPaid), rentTotal);
  const rentDue = Math.max(0, rentTotal - paidTowardRent);
  return { rentTotal, securityInTotal, rentDue, securityHeld: securityInTotal };
}
