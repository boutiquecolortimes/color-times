// Adds the product code to rental lines on existing booking invoices:
//   "Rental — PDP Pink Crop Top (36), …"  →  "Rental — PDP012 - PDP Pink Crop Top (36), …"
// New and re-synced invoices already get it (app/api/admin/invoices/from-booking).
//
// Usage (from the project folder):
//   npm run backfill:invoice-product-codes              # dry run
//   npm run backfill:invoice-product-codes -- --apply   # saves the changes
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
console.log(`Database: ${db.databaseName}${apply ? "" : "  (dry run, pass --apply to save)"}`);

const invoices = db.collection("invoices");
const bookings = db.collection("bookings");
const products = db.collection("products");

const cursor = invoices.find({ booking: { $ne: null }, "lineItems.description": /^Rental — / });
let changedInvoices = 0;
let changedLines = 0;
for await (const invoice of cursor) {
  const booking = await bookings.findOne({ _id: invoice.booking }, { projection: { items: 1 } });
  if (!booking?.items?.length) continue;
  const ids = booking.items.map((i) => i.product).filter(Boolean);
  const list = await products.find({ _id: { $in: ids } }, { projection: { name: 1, sku: 1 } }).toArray();
  const skuByName = new Map(list.filter((p) => p.sku).map((p) => [p.name, p.sku]));

  let touched = false;
  const lineItems = invoice.lineItems.map((line) => {
    const m = typeof line.description === "string" && line.description.match(/^Rental — (.*) \((.*)\), (.+)$/);
    if (!m) return line;
    const [, name, size, rest] = m;
    const sku = skuByName.get(name);
    if (!sku) return line; // already has a code, or the product name changed
    touched = true;
    changedLines++;
    const description = `Rental — ${sku} - ${name} (${size}), ${rest}`;
    console.log(`  ${invoice.invoiceNumber}: ${description}`);
    return { ...line, description };
  });
  if (!touched) continue;
  changedInvoices++;
  if (apply) await invoices.updateOne({ _id: invoice._id }, { $set: { lineItems } });
}
console.log(`${changedLines} line(s) on ${changedInvoices} invoice(s) ${apply ? "updated" : "would be updated"}.`);
await mongoose.disconnect();
