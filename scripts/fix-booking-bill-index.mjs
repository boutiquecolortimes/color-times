// Makes booking bill numbers unique among live bookings only, so a booking
// in Trash no longer blocks a new booking with the same bill number.
// Drops the old global unique index (billNumber_1) and creates
// billNumber_active_unique (partial: deletedAt is null).
//
// Usage (from the project folder):
//   npm run fix:booking-bill-index              # dry run: shows what would change
//   npm run fix:booking-bill-index -- --apply   # makes the change
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
console.log(`Database: ${db.databaseName}${apply ? "" : "  (dry run, pass --apply to change)"}`);

const bookings = db.collection("bookings");
const indexes = await bookings.indexes();
const old = indexes.find(
  (i) => i.key?.billNumber === 1 && Object.keys(i.key).length === 1 && i.unique && !i.partialFilterExpression
);
const hasNew = indexes.some((i) => i.name === "billNumber_active_unique");

// Live bookings that already share a bill number would make the new index fail.
const dupes = await bookings
  .aggregate([
    { $match: { deletedAt: null, billNumber: { $type: "string" } } },
    { $group: { _id: "$billNumber", n: { $sum: 1 }, bookings: { $push: "$bookingNumber" } } },
    { $match: { n: { $gt: 1 } } },
  ])
  .toArray();
if (dupes.length) {
  console.log("Live bookings sharing a bill number (fix these first):");
  for (const d of dupes) console.log(`  ${d._id}: ${d.bookings.join(", ")}`);
}

console.log(old ? `Old index to drop: ${old.name}` : "Old global index: not present");
console.log(hasNew ? "New index: already present" : "New index: to create");

if (apply) {
  if (dupes.length) {
    console.log("Stopped: resolve the duplicates above, then run again.");
    process.exit(1);
  }
  if (old) {
    await bookings.dropIndex(old.name);
    console.log(`Dropped ${old.name}`);
  }
  if (!hasNew) {
    await bookings.createIndex(
      { billNumber: 1 },
      {
        name: "billNumber_active_unique",
        unique: true,
        partialFilterExpression: { deletedAt: { $type: "null" }, billNumber: { $type: "string" } },
      }
    );
    console.log("Created billNumber_active_unique");
  }
  console.log("Done.");
}
await mongoose.disconnect();
