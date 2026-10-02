// One-time backfill: give every existing Sale and Customisation order its
// invoice in the Invoices menu (with the advance as its first payment), the
// same way new ones get one automatically. Safe to re-run — an order that
// already has an invoice is just brought up to date, never duplicated.
//
//   npm run backfill:order-invoices            # dry run — counts only
//   npm run backfill:order-invoices -- --apply # actually create/update
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import { Invoice } from "@/models/Invoice";
import { User } from "@/models/User";
import { syncOrderInvoice } from "@/lib/admin/order-invoices";
import type { AccessTokenPayload } from "@/lib/auth/tokens";

async function main() {
  const apply = process.argv.includes("--apply");
  await connectToDatabase();

  const admin = await User.findOne({ role: { $in: ["super_admin", "admin"] } })
    .sort({ createdAt: 1 })
    .lean();
  if (!admin) throw new Error("No admin user found to record the backfill under.");
  const actor: AccessTokenPayload = {
    sub: String(admin._id),
    email: admin.email,
    role: admin.role,
    name: `${admin.name} (backfill)`,
  };

  const sales = await Sale.find({ source: { $ne: "booking" } }).select("_id").lean();
  const orders = await CustomisationOrder.find().select("_id status").lean();
  const [salesWithInvoice, ordersWithInvoice] = await Promise.all([
    Invoice.countDocuments({ sale: { $in: sales.map((s) => s._id) } }),
    Invoice.countDocuments({ customisationOrder: { $in: orders.map((o) => o._id) } }),
  ]);

  console.log(`Sales: ${sales.length} (${salesWithInvoice} already have an invoice)`);
  console.log(`Customisation orders: ${orders.length} (${ordersWithInvoice} already have an invoice)`);

  if (!apply) {
    console.log("\nDry run — nothing changed. Re-run with --apply to create/update invoices.");
    process.exit(0);
  }

  let done = 0;
  for (const sale of sales) {
    await syncOrderInvoice("sale", String(sale._id), actor, "sale_created");
    done += 1;
  }
  for (const order of orders) {
    const stage = order.status === "pending" ? "order_created" : order.status;
    await syncOrderInvoice("customisation", String(order._id), actor, stage);
    done += 1;
  }
  console.log(`\nDone — ${done} invoices created or updated.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
