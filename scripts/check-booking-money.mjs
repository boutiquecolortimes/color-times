// Prints the money fields of recent bookings so payment issues can be checked.
// Usage (from the project folder):
//   node --env-file=.env.local scripts/check-booking-money.mjs            -> latest 5 bookings
//   node --env-file=.env.local scripts/check-booking-money.mjs 1712       -> booking by bill number
//   node --env-file=.env.local scripts/check-booking-money.mjs CTB-2026-01100
// The live data is in the "test" database (see DB_NAME below).
import mongoose from "mongoose";

const DB_NAME = process.env.DB_NAME || "test";
const arg = process.argv[2];
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.getClient().db(DB_NAME);

const filter = arg ? { $or: [{ billNumber: arg }, { bookingNumber: arg.toUpperCase() }] } : { deletedAt: null };
const bookings = await db.collection("bookings").find(filter).sort({ createdAt: -1 }).limit(arg ? 5 : 5).toArray();
if (!bookings.length) {
  console.log(`No booking found in database "${DB_NAME}"${arg ? ` for ${arg}` : ""}.`);
  process.exit(0);
}

for (const b of bookings) {
  const customer = await db.collection("users").findOne({ _id: b.customer }, { projection: { name: 1, phone: 1 } });
  const rent = (b.items ?? []).reduce((s, i) => s + (i.rentalFee ?? 0), 0);
  console.log(`\n=== ${b.bookingNumber}  bill ${b.billNumber}  [${b.status}]  created ${b.createdAt?.toISOString?.().slice(0, 16)}`);
  console.log(`Customer: ${customer?.name ?? b.customer}  ${customer?.phone ?? ""}`);
  console.log(`Pickup ${fmt(b.rentalStartDate)} -> Return ${fmt(b.rentalEndDate)}`);
  console.log("Items:", (b.items ?? []).map((i) => `rent ${i.rentalFee} (perDay ${i.pricePerDay})`).join(", "));
  // Every money-ish field on the document, so nothing is hidden.
  const money = {};
  for (const [k, v] of Object.entries(b)) {
    if (typeof v === "number" || /amount|paid|deposit|refund|charge|due|payment|settle|rent/i.test(k)) money[k] = v;
  }
  console.log("Money fields:", JSON.stringify(money, null, 1));
  console.log(`Computed: rent ${rent} | security ${b.securityDeposit} | total ${b.totalAmount} | paid ${b.advancePaid} | due ${b.totalAmount - b.advancePaid}`);
}
await mongoose.disconnect();
