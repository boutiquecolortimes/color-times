// Finds bookings where the customer paid more than the rent but the extra
// was never recorded as security deposit, and (with --apply) fixes them.
//
//   node --env-file=.env.local scripts/fix-excess-advance.mjs          -> list only, changes nothing
//   node --env-file=.env.local scripts/fix-excess-advance.mjs --apply  -> fix open bookings
//
// Live data is in the "test" database (override with DB_NAME=...).
import mongoose from "mongoose";

const DB_NAME = process.env.DB_NAME || "test";
const APPLY = process.argv.includes("--apply");
const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.getClient().db(DB_NAME);
const bookings = db.collection("bookings");

const candidates = await bookings
  .find({ deletedAt: null, status: { $ne: "cancelled" } })
  .project({ bookingNumber: 1, billNumber: 1, status: 1, customer: 1, rentalStartDate: 1, totalAmount: 1, securityDeposit: 1, advancePaid: 1 })
  .toArray();

const open = [];
const settled = [];
for (const b of candidates) {
  const rent = (b.totalAmount ?? 0) - (b.securityDeposit ?? 0);
  const paid = b.advancePaid ?? 0;
  const extra = paid - rent;
  if (extra > (b.securityDeposit ?? 0)) {
    const customer = await db.collection("users").findOne({ _id: b.customer }, { projection: { name: 1, phone: 1 } });
    const row = {
      booking: b.bookingNumber,
      bill: b.billNumber,
      customer: customer?.name ?? "?",
      status: b.status,
      pickup: fmt(b.rentalStartDate),
      rent: inr(rent),
      paid: inr(paid),
      securityNow: inr(b.securityDeposit ?? 0),
      securityShouldBe: inr(extra),
      _id: b._id,
      _rent: rent,
      _security: extra,
    };
    (b.status === "returned" ? settled : open).push(row);
  }
}

const show = (rows) => console.table(rows.map(({ _id, _rent, _security, ...r }) => r));

console.log(`Database "${DB_NAME}"\n`);
if (open.length) {
  console.log(`OPEN bookings where extra payment isn't recorded as security (${open.length}):`);
  show(open);
} else console.log("No open bookings with unrecorded extra payment.");

if (settled.length) {
  console.log(`\nALREADY RETURNED — extra was likely never refunded (${settled.length}). Not changed automatically; check with the customer:`);
  show(settled);
}

if (APPLY && open.length) {
  for (const r of open) {
    await bookings.updateOne(
      { _id: r._id },
      { $set: { securityDeposit: r._security, totalAmount: r._rent + r._security } }
    );
  }
  console.log(`\n✓ Fixed ${open.length} open booking(s): extra payment now recorded as security deposit.`);
} else if (open.length) {
  console.log("\nNothing changed. Run again with --apply to fix the OPEN bookings above.");
}
await mongoose.disconnect();
