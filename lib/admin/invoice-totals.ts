// Splits an invoice's outstanding balance into what's actually still owed
// for the rent vs. what's still owed for the security deposit.
//
// Why this exists: `total` (and therefore `amountDue`) includes the security
// deposit for any booking that hasn't been returned yet, so a plain "Due"
// figure silently blends "the customer still owes rent" with "we're still
// waiting on the security deposit" into one number. In practice the deposit
// is usually collected and held separately (cash/valuables kept at the
// counter) rather than logged as an invoice payment the moment it changes
// hands, so that blended number kept showing the deposit as still "due"
// even once it was sitting in the drawer. Splitting it lets the UI show the
// real rent balance on its own, with the deposit called out separately.
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
   * What's still owed toward the security deposit. Payments recorded on the
   * invoice are applied to rent first, so this only clears once a payment
   * covering the deposit is explicitly recorded (e.g. via Record Payment).
   */
  securityDue: number;
}

export function getInvoiceDueBreakdown(invoice: InvoiceDueBreakdownInput): InvoiceDueBreakdown {
  const rentTotal = Math.max(0, invoice.subtotal - invoice.discountAmount + invoice.taxAmount);
  const securityInTotal = Math.max(0, invoice.total - rentTotal);
  const paidTowardRent = Math.min(Math.max(0, invoice.amountPaid), rentTotal);
  const rentDue = Math.max(0, rentTotal - paidTowardRent);
  const paidTowardSecurity = Math.max(0, invoice.amountPaid - rentTotal);
  const securityDue = Math.max(0, securityInTotal - paidTowardSecurity);
  return { rentTotal, securityInTotal, rentDue, securityDue };
}
