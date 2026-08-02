/**
 * One-time reset: wipes Invoices, Bookings, and Products, plus every
 * customer account (User with role "customer") — everything except staff
 * logins (Team members under /admin/users, any role other than "customer").
 *
 * This is destructive and irreversible. It does NOT run automatically —
 * without --confirm it only prints how many documents of each type exist
 * right now and exits, so you can see the blast radius before committing.
 *
 * Usage:
 *   npm run reset:transactional-data                 # dry run — counts only
 *   npm run reset:transactional-data -- --confirm     # actually deletes
 *
 * Run this against production with a fresh backup/export on hand
 * (mongodump, or an Atlas snapshot) — there is no undo.
 */
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { User } from "@/models/User";

async function main() {
  const confirmed = process.argv.includes("--confirm");

  await connectToDatabase();

  const [invoiceCount, bookingCount, productCount, customerCount, staffCount] = await Promise.all([
    Invoice.countDocuments({}),
    Booking.countDocuments({}),
    Product.countDocuments({}),
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: { $ne: "customer" } }),
  ]);

  console.log("Current document counts:");
  console.log(`  Invoices:                ${invoiceCount}`);
  console.log(`  Bookings:                ${bookingCount}`);
  console.log(`  Products:                ${productCount}`);
  console.log(`  Customers (role=customer): ${customerCount}`);
  console.log(`  Staff/team logins (kept): ${staffCount}`);

  if (!confirmed) {
    console.log(
      "\nDry run only — nothing was deleted. Re-run with `-- --confirm` to actually delete the rows above."
    );
    process.exit(0);
  }

  console.log("\n--confirm passed. Deleting now...");

  const [invoiceResult, bookingResult, productResult, customerResult] = await Promise.all([
    Invoice.deleteMany({}),
    Booking.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({ role: "customer" }),
  ]);

  console.log("Done:");
  console.log(`  Deleted ${invoiceResult.deletedCount} invoice(s).`);
  console.log(`  Deleted ${bookingResult.deletedCount} booking(s).`);
  console.log(`  Deleted ${productResult.deletedCount} product(s).`);
  console.log(`  Deleted ${customerResult.deletedCount} customer(s).`);
  console.log(`  Kept ${staffCount} staff/team login(s) — untouched.`);
  console.log(
    "\nNote: Categories, Team/User accounts, audit logs, and other supporting collections were left alone — only Invoices, Bookings, Products, and customer accounts were cleared."
  );

  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to reset transactional data:", error);
  process.exit(1);
});
