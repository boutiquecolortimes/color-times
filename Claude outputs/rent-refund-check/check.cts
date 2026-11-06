const { securityIncludingExcess, scaleItemRentalFees, bookingRemainingDue, bookingDepositHeld, bookingDepositState, bookingPaidBreakdown, bookingDepositUsed } = require("../../lib/admin/booking-status.ts");
// Copied verbatim from lib/validations/booking.ts (that file pulls in zod/aliases).
function computeBookingSettlement(input: { securityDeposit: number; damageCharges: number; pendingRentAmount: number }) {
  const amountOwed = input.damageCharges + input.pendingRentAmount;
  const netPosition = amountOwed - input.securityDeposit;
  return { depositRefundAmount: netPosition < 0 ? -netPosition : 0, finalSettlementAmount: netPosition };
}

type B = { depositBeforeRentRefund?: number | null; items: { rentalFee: number }[]; totalAmount: number; securityDeposit: number; advancePaid: number; status: string; depositRefundAmount?: number; depositRefunded?: boolean; rentRefundAmount?: number; damageCharges?: number };
let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✔" : "✘"} ${label}: ${JSON.stringify(got)}${ok ? "" : `  (want ${JSON.stringify(want)})`}`);
};

// Mirrors the Return branch of PATCH /api/admin/bookings/[id] (client sends what the dialog computes).
function doReturn(before: B, opts: { rentRefund?: number; securityDeposit?: number; damage?: number }): B {
  const originalRent = Math.max(0, before.totalAmount - before.securityDeposit);
  const rentRefund = Math.min(Math.max(0, opts.rentRefund ?? 0), originalRent);
  const rent = originalRent - rentRefund;
  const items = rentRefund > 0 ? scaleItemRentalFees(before.items, originalRent, rent) : before.items;
  const sec = securityIncludingExcess(rent, before.advancePaid, opts.securityDeposit ?? before.securityDeposit);
  const pending = Math.max(0, rent - before.advancePaid); // dialog default
  const s = computeBookingSettlement({ securityDeposit: sec, damageCharges: opts.damage ?? 0, pendingRentAmount: pending });
  return { ...before, depositBeforeRentRefund: rentRefund > 0 ? before.securityDeposit : null, items, status: "returned", securityDeposit: sec, totalAmount: rent + sec, rentRefundAmount: rentRefund, depositRefundAmount: s.depositRefundAmount, depositRefunded: true, damageCharges: opts.damage ?? 0 };
}
// Mirrors undo-return.
function undo(b: B): B {
  const rr = b.rentRefundAmount ?? 0;
  const cur = Math.max(0, b.totalAmount - b.securityDeposit);
  const dep = rr > 0 ? (b.depositBeforeRentRefund ?? b.securityDeposit) : b.securityDeposit;
  return { ...b, status: "in_use", securityDeposit: dep, items: rr > 0 ? scaleItemRentalFees(b.items, cur, cur + rr) : b.items, totalAmount: rr > 0 ? cur + rr + dep : b.totalAmount, rentRefundAmount: 0, depositRefundAmount: 0, depositRefunded: false, damageCharges: 0 };
}
// Mirrors invoice sync for a returned booking (no tax/discount).
function invoice(b: B) {
  const subtotal = b.items.reduce((s, i) => s + i.rentalFee, 0) + (b.damageCharges ?? 0);
  const depositApplied = Math.max(0, b.securityDeposit - (b.depositRefundAmount ?? 0));
  const total = subtotal;
  const amountPaid = Math.min(total, b.advancePaid + depositApplied);
  return { subtotal, total, amountPaid, amountDue: Math.max(0, total - amountPaid) };
}
const rentOf = (b: B) => b.totalAmount - b.securityDeposit;
const itemsSum = (b: B) => b.items.reduce((s, i) => s + i.rentalFee, 0);
const cashNet = (b: B) => b.advancePaid - (b.depositRefundAmount ?? 0);

console.log("\n# 1. Geeta's case — 2 lehengas ₹4,200, paid ₹5,000 (₹800 deposit), give back ₹200 rent");
const g0: B = { items: [{ rentalFee: 2100 }, { rentalFee: 2100 }], totalAmount: 5000, securityDeposit: 800, advancePaid: 5000, status: "in_use" };
const g = doReturn(g0, { rentRefund: 200 });
eq("rent (reports/dashboard)", rentOf(g), 4000);
eq("items rentalFee (per-dress earnings)", g.items.map((i) => i.rentalFee), [2000, 2000]);
eq("rent == items sum", rentOf(g) === itemsSum(g), true);
eq("refund to customer", g.depositRefundAmount, 1000);
eq("cash kept = rent", cashNet(g), 4000);
eq("remaining due", bookingRemainingDue(g), 0);
eq("deposit used for rent/damage", bookingDepositUsed(g), 0);
eq("deposit state", bookingDepositState(g), "refunded");
eq("deposit held", bookingDepositHeld(g), 0);
eq("invoice", invoice(g), { subtotal: 4000, total: 4000, amountPaid: 4000, amountDue: 0 });
eq("paid breakdown", bookingPaidBreakdown(g), { advance: 5000, duePaid: 0, securityHeld: 1000 });

console.log("\n# 2. OLD workaround for comparison — deposit raised 800 → 1000, no rent refund");
const w = doReturn(g0, { securityDeposit: 1000 });
eq("rent shown (wrong, was the bug)", rentOf(w), 4200);
eq("cash kept", cashNet(w), 4000);

console.log("\n# 3. Rent not fully paid — rent ₹4,200, paid ₹2,000, no deposit, ₹200 rent refund");
const p = doReturn({ items: [{ rentalFee: 4200 }], totalAmount: 4200, securityDeposit: 0, advancePaid: 2000, status: "in_use" }, { rentRefund: 200 });
eq("rent", rentOf(p), 4000);
eq("refund", p.depositRefundAmount, 0);
eq("still due", bookingRemainingDue(p), 2000);
eq("invoice due", invoice(p).amountDue, 2000);

console.log("\n# 4. Uneven 3 dresses ₹1,000/₹1,000/₹1,001, ₹100 rent refund — rounding stays exact");
const r = doReturn({ items: [{ rentalFee: 1000 }, { rentalFee: 1000 }, { rentalFee: 1001 }], totalAmount: 3501, securityDeposit: 500, advancePaid: 3501, status: "in_use" }, { rentRefund: 100 });
eq("rent", rentOf(r), 2901);
eq("items sum == rent", itemsSum(r), 2901);
eq("refund", r.depositRefundAmount, 600);

console.log("\n# 5. Refund bigger than rent is capped");
const c = doReturn({ items: [{ rentalFee: 1000 }], totalAmount: 1500, securityDeposit: 500, advancePaid: 1500, status: "in_use" }, { rentRefund: 9999 });
eq("rent", rentOf(c), 0);
eq("refund = all money paid", c.depositRefundAmount, 1500);

console.log("\n# 6. With damage — ₹200 rent refund, ₹300 damage");
const d = doReturn(g0, { rentRefund: 200, damage: 300 });
eq("refund", d.depositRefundAmount, 700);
eq("invoice", invoice(d), { subtotal: 4300, total: 4300, amountPaid: 4300, amountDue: 0 });
eq("cash kept = rent + damage", cashNet(d), 4300);

console.log("\n# 7. No rent refund — unchanged from before");
const n = doReturn(g0, {});
eq("rent", rentOf(n), 4200);
eq("refund", n.depositRefundAmount, 800);
eq("items untouched", n.items, g0.items);

console.log("\n# 8. Undo Return puts the rent back");
const u = undo(g);
eq("rent", rentOf(u), 4200);
eq("items", u.items.map((i) => i.rentalFee), [2100, 2100]);
eq("remaining due", bookingRemainingDue(u), 0);
eq("rentRefundAmount", u.rentRefundAmount, 0);
eq("deposit back to ₹800", u.securityDeposit, 800);
eq("total back to ₹5,000 (= paid, invoice not short)", u.totalAmount, 5000);
eq("deposit held while picked up", bookingDepositHeld(u), 800);
console.log("\n# 9. Return again after undo with same ₹200");
const g2 = doReturn(u, { rentRefund: 200 });
eq("rent", rentOf(g2), 4000);
eq("refund", g2.depositRefundAmount, 1000);

console.log(fail ? `\n${fail} FAILED` : "\nALL PASSED");
process.exit(fail ? 1 : 0);
