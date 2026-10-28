// Finds dresses by code or (part of) name across every database on the
// cluster, and prints each one's bookings with saved pickup/return dates.
//
// Usage (from the project folder):
//   node --env-file=.env.local scripts/check-dress-bookings.mjs levender
import mongoose from "mongoose";

const query = process.argv.slice(2).join(" ").trim() || "levender";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Loose match: every word must appear, extra spaces/case ignored.
const words = query.split(/\s+/).map(escape);
const nameRegex = new RegExp(words.map((w) => `(?=.*${w})`).join(""), "i");
const skuRegex = new RegExp(escape(query.replace(/\s+/g, "")), "i");

const BLOCKING = ["pending_payment", "confirmed", "in_use"];
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

await mongoose.connect(process.env.MONGODB_URI);
const client = mongoose.connection.getClient();
console.log(`Connected. Default database: ${mongoose.connection.db.databaseName}`);

const { databases } = await client.db().admin().listDatabases();
let found = 0;

for (const { name: dbName } of databases) {
  if (["admin", "local", "config"].includes(dbName)) continue;
  const db = client.db(dbName);
  const products = await db
    .collection("products")
    .find({ $or: [{ name: nameRegex }, { sku: skuRegex }] })
    .project({ name: 1, sku: 1, deletedAt: 1 })
    .toArray();

  if (products.length === 0) {
    console.log(`- ${dbName}: no match for "${query}"`);
    continue;
  }

  for (const product of products) {
    found += 1;
    console.log(
      `\n=== Database "${dbName}": ${JSON.stringify(product.name)} sku=${JSON.stringify(product.sku)} id=${product._id}` +
        (product.deletedAt ? " (in trash)" : "")
    );
    const bookings = await db
      .collection("bookings")
      .find({ "items.product": product._id })
      .sort({ rentalStartDate: 1 })
      .toArray();

    if (bookings.length === 0) {
      console.log("   (no bookings)");
      continue;
    }
    console.table(
      bookings.map((b) => {
        const days = Math.round((new Date(b.rentalEndDate) - new Date(b.rentalStartDate)) / 86400000);
        const blocks = !b.deletedAt && BLOCKING.includes(b.status);
        return {
          booking: b.bookingNumber,
          bill: b.billNumber,
          status: b.status + (b.deletedAt ? " (trash)" : ""),
          pickup: fmt(b.rentalStartDate),
          return: fmt(b.rentalEndDate),
          days,
          blocksCalendar: blocks ? "YES" : "no",
          warning: blocks && days > 30 ? "<-- return date looks wrong" : "",
        };
      })
    );
  }
}

if (!found) console.log(`\nNo dress matching "${query}" in any database on this cluster.`);
await mongoose.disconnect();
