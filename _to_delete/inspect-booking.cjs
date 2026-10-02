// READ-ONLY: prints one booking, its invoice and audit trail.
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const b = await db.collection("bookings").findOne({ bookingNumber: "CTB-2026-01029" });
  if (!b) { console.log("not found"); process.exit(0); }
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
  console.log("BOOKING", JSON.stringify(pick(b, ["status","billNumber","totalAmount","securityDeposit","advancePaid","pickupPaid","pendingRentAmount","damageCharges","depositRefunded","depositRefundAmount","finalSettlementAmount","createdAt","updatedAt"]), null, 1));
  console.log("ITEMS", JSON.stringify(b.items.map((i) => pick(i, ["product","rentalFee","pricePerDay","quantity","size"]))));
  const inv = await db.collection("invoices").find({ booking: b._id }).toArray();
  for (const i of inv) console.log("INVOICE", JSON.stringify(pick(i, ["invoiceNumber","status","subtotal","securityDeposit","total","amountPaid","amountDue","depositRefunded","bookingStage","stageHistory","lineItems","payments","deletedAt","createdAt"]), null, 1));
  const logs = await db.collection("auditlogs").find({ entityId: String(b._id) }).sort({ createdAt: 1 }).toArray();
  for (const l of logs) console.log("LOG", l.createdAt?.toISOString(), l.action, JSON.stringify(l.changes ?? []).slice(0, 600), JSON.stringify(l.metadata ?? {}).slice(0, 200));
  const invLogs = await db.collection("auditlogs").find({ entityId: { $in: inv.map((i) => String(i._id)) } }).sort({ createdAt: 1 }).toArray();
  for (const l of invLogs) console.log("INVLOG", l.createdAt?.toISOString(), l.action, JSON.stringify(l.changes ?? []).slice(0, 400), JSON.stringify(l.metadata ?? {}).slice(0, 200));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
