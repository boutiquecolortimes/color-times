// Finds RETURNED bookings where part of the rent was given back by raising
// the security deposit at Return (the old workaround, before "Rent refund"
// existed) and, with --apply, re-records it as a rent refund.
//
// Signature: rent was fully paid, yet the deposit on file is bigger than what
// was actually paid beyond the rent. The difference is rent that was handed
// back, so: rent goes down by it, deposit/refund stay as they are, and the
// booking's invoice is brought in line.
//
// Example: rent ₹4,200, paid ₹5,000 (₹800 deposit), deposit raised to ₹1,000
//          → rent ₹4,000, deposit ₹1,000, total ₹5,000, rent refund ₹200.
//
//   node --env-file=.env.local scripts/fix-rent-refund-as-deposit.mjs                 -> list only
//   node --env-file=.env.local scripts/fix-rent-refund-as-deposit.mjs --bill 123      -> list one bill
//   node --env-file=.env.local scripts/fix-rent-refund-as-deposit.mjs --bill 123 --apply
//
// Live data is in the "test" database (override with DB_NAME=...).
import mongoose from "mongoose";

const DB_NAME = process.env.DB_NAME || "test";
const APPLY = process.argv.includes("--apply");
const billIdx = process.argv.indexOf("--bill");
const BILL = billIdx > -1 ? process.argv[billIdx + 1] : null;
const inr = (n) => `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;

if (APPLY && !BILL) {
  console.error("Refusing to --apply without --bill <billNumber>. Review the list first, then fix one bill at a time.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.getClient().db(DB_NAME);
const bookings = db.collection("bookings");
const invoices = db.collection("invoices");
const sales = db.collection("sales");
const admin = await db.collection("users").findOne(
  { role: { $in: ["super_admin", "admin"] } },
  { sort: { createdAt: 1 }, projection: { name: 1, email: 1 } }
);

const filter = { deletedAt: null, status: "returned", ...(BILL ? { billNumber: BILL } : {}) };
const list = await bookings.find(filter).toArray();

const hits = [];
for (const b of list) {
  const rent = (b.totalAmount ?? 0) - (b.securityDeposit ?? 0);
  const paid = b.advancePaid ?? 0;
  if (paid < rent) continue; // rent not fully paid — not this pattern
  const collectedBeyondRent = paid - rent;
  const inflated = (b.securityDeposit ?? 0) - collectedBeyondRent;
  if (inflated <= 0 || (b.rentRefundAmount ?? 0) > 0) continue;
  hits.push({ b, rent, paid, inflated });
}

if (hits.length === 0) {
  console.log(BILL ? `Bill ${BILL}: nothing to fix (no returned booking with an inflated deposit).` : "No affected bookings found.");
  await mongoose.disconnect();
  process.exit(0);
}

for (const { b, rent, paid, inflated } of hits) {
  const customer = await db.collection("users").findOne({ _id: b.customer }, { projection: { name: 1, phone: 1 } });
  const newRent = rent - inflated;
  console.log(
    `\n${b.bookingNumber} | bill ${b.billNumber} | ${customer?.name ?? "?"} ${customer?.phone ?? ""}\n` +
      `  rent ${inr(rent)} → ${inr(newRent)} (rent refund ${inr(inflated)})\n` +
      `  paid ${inr(paid)}, deposit ${inr(b.securityDeposit)} (unchanged), refund ${inr(b.depositRefundAmount ?? 0)} (unchanged)\n` +
      `  total ${inr(b.totalAmount)} → ${inr(newRent + b.securityDeposit)}`
  );
  if (!APPLY) continue;

  // Re-price items so they sum exactly to the new rent.
  const items = b.items ?? [];
  let newItems = items;
  if (items.length > 0) {
    newItems = rent > 0
      ? items.map((it) => ({ ...it, rentalFee: Math.round(((it.rentalFee ?? 0) * newRent) / rent) }))
      : items.map((it, i) => ({ ...it, rentalFee: i === 0 ? newRent : 0 }));
    const drift = newRent - newItems.reduce((s, it) => s + it.rentalFee, 0);
    newItems[newItems.length - 1].rentalFee = Math.max(0, newItems[newItems.length - 1].rentalFee + drift);
  }

  await bookings.updateOne(
    { _id: b._id },
    { $set: { items: newItems, totalAmount: newRent + b.securityDeposit, rentRefundAmount: inflated, depositBeforeRentRefund: b.securityDeposit - inflated, updatedAt: new Date() } }
  );
  if (admin) await db.collection("auditlogs").insertOne({
    entityType: "Booking",
    entityId: String(b._id),
    action: "update",
    actorId: admin?._id,
    actorName: `${admin?.name ?? "Admin"} (script)`,
    actorEmail: admin?.email ?? "script@local",
    changes: [
      { field: "totalAmount", from: b.totalAmount, to: newRent + b.securityDeposit },
      { field: "rentRefundAmount", from: 0, to: inflated },
    ],
    metadata: { script: "fix-rent-refund-as-deposit" },
    createdAt: new Date(),
  }).catch(() => {});
  console.log("  ✔ booking updated");

  // Bring the booking's invoice(s) in line — returned invoices bill rent + damage only.
  const invs = await invoices.find({ booking: b._id, status: { $ne: "cancelled" } }).toArray();
  for (const inv of invs) {
    if ((inv.taxRate ?? 0) > 0 || (inv.discountAmount ?? 0) > 0) {
      console.log(`  ⚠ invoice ${inv.invoiceNumber} has tax/discount — fix it by hand (Generate Invoice on the booking won't lower amount paid).`);
      continue;
    }
    let left = inflated;
    const rentLines = inv.lineItems.filter((li) => String(li.description).startsWith("Rental"));
    const rentLinesTotal = rentLines.reduce((s, li) => s + li.amount, 0);
    const lineItems = inv.lineItems.map((li) => {
      if (!String(li.description).startsWith("Rental") || rentLinesTotal <= 0) return li;
      const cut = Math.min(left, Math.round((li.amount * inflated) / rentLinesTotal));
      left -= cut;
      const amount = li.amount - cut;
      return { ...li, amount, unitPrice: amount / (li.quantity || 1) };
    });
    // Rounding leftover on the last rent line.
    if (left !== 0) {
      for (let i = lineItems.length - 1; i >= 0; i--) {
        if (String(lineItems[i].description).startsWith("Rental")) {
          lineItems[i] = { ...lineItems[i], amount: lineItems[i].amount - left, unitPrice: (lineItems[i].amount - left) / (lineItems[i].quantity || 1) };
          break;
        }
      }
    }
    const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
    const total = inv.total - inflated;
    const amountPaid = Math.min(inv.amountPaid ?? 0, total);
    const amountDue = Math.max(0, total - amountPaid);
    await invoices.updateOne(
      { _id: inv._id },
      { $set: { lineItems, subtotal, total, amountPaid, amountDue, status: amountDue === 0 ? "paid" : inv.status, updatedAt: new Date() } }
    );
    await sales.updateMany(
      { source: "booking", details: { $regex: String(inv.invoiceNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } },
      { $set: { totalAmount: total, updatedAt: new Date() } }
    );
    console.log(`  ✔ invoice ${inv.invoiceNumber}: total ${inr(inv.total)} → ${inr(total)}, paid ${inr(inv.amountPaid)} → ${inr(amountPaid)}`);
  }
}

if (!APPLY) console.log(`\n${hits.length} booking(s) found. Re-run with --bill <billNumber> --apply to fix one.`);
await mongoose.disconnect();
