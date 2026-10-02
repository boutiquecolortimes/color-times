import "server-only";
import type { Types } from "mongoose";
import {
  Invoice,
  type InvoicePayment,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/models/Invoice";
import { Sale } from "@/models/Sale";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import "@/models/Product";
import { generateInvoiceNumber } from "@/lib/admin/invoice-number";
import { recordAuditLog } from "@/lib/audit/log";
import { notifyPaymentReceived } from "@/lib/notifications/whatsapp-events";
import type { AccessTokenPayload } from "@/lib/auth/tokens";

// Sales and Customisation orders each get one invoice in the Invoices menu,
// kept in step with the order — same idea as booking invoices. The order
// stays the source of truth for amounts (total, advance, duePaid); the
// invoice mirrors them and holds the payment history:
//   • one "advance" entry — the advance entered on the order
//   • one "due" entry per payment collected afterwards (Collect payment)

export type OrderKind = "sale" | "customisation";

const LINK_FIELD: Record<OrderKind, "sale" | "customisationOrder"> = {
  sale: "sale",
  customisation: "customisationOrder",
};

interface OrderSnapshot {
  billNumber: string;
  date: Date;
  customer: Types.ObjectId | null;
  billTo: { name: string; phone?: string; address?: string };
  lineItems: { description: string; quantity: number; unitPrice: number; amount: number }[];
  total: number;
  advance: number;
  duePaid: number;
  cancelled: boolean;
  deleted: boolean;
}

async function loadOrder(kind: OrderKind, id: string): Promise<OrderSnapshot | null> {
  if (kind === "sale") {
    const sale = await Sale.findById(id).populate("product", "name sku").lean();
    if (!sale || sale.source === "booking") return null;
    const product = sale.product as unknown as { name?: string; sku?: string } | null;
    const productText = product?.name
      ? `${product.name}${product.sku ? ` (${product.sku})` : ""}`
      : "Dress";
    const total = sale.totalAmount ?? 0;
    return {
      billNumber: sale.billNumber,
      date: sale.saleDate ?? sale.createdAt ?? new Date(),
      customer: (sale.customer as Types.ObjectId | undefined) ?? null,
      billTo: { name: sale.customerName, phone: sale.customerPhone, address: sale.customerAddress },
      lineItems: [
        {
          description: `Dress sale — ${productText}${sale.details ? ` — ${sale.details}` : ""}`,
          quantity: 1,
          unitPrice: total,
          amount: total,
        },
      ],
      total,
      advance: sale.advancePayment ?? 0,
      duePaid: sale.duePaid ?? 0,
      cancelled: false,
      deleted: Boolean(sale.deletedAt),
    };
  }

  const order = await CustomisationOrder.findById(id).lean();
  if (!order) return null;
  const total = order.totalAmount ?? 0;
  return {
    billNumber: order.billNumber,
    date: order.orderDate ?? order.createdAt ?? new Date(),
    customer: (order.customer as Types.ObjectId | undefined) ?? null,
    billTo: { name: order.customerName, phone: order.customerPhone, address: order.customerAddress },
    lineItems: [
      {
        description: `Customisation — ${order.stitchingType}${order.detail ? `: ${order.detail}` : ""}`,
        quantity: 1,
        unitPrice: total,
        amount: total,
      },
    ],
    total,
    advance: order.advancePayment ?? 0,
    duePaid: order.duePaid ?? 0,
    cancelled: order.status === "cancelled",
    deleted: Boolean(order.deletedAt),
  };
}

/**
 * Creates or updates the invoice for a sale / customisation order so it
 * matches the order right now. `stage` (e.g. "sale_created", "payment",
 * "delivered") is recorded as the reason in the invoice's history.
 */
export async function syncOrderInvoice(
  kind: OrderKind,
  orderId: string,
  actor: AccessTokenPayload,
  stage?: string
) {
  const order = await loadOrder(kind, orderId);
  if (!order) return null;

  const field = LINK_FIELD[kind];
  const existing = await Invoice.findOne({ [field]: orderId }).lean();

  const amountPaid = Math.min(order.total, order.advance + order.duePaid);
  const amountDue = Math.max(0, order.total - amountPaid);
  const status: InvoiceStatus = order.cancelled
    ? "cancelled"
    : amountDue === 0
      ? "paid"
      : amountPaid > 0
        ? "partially_paid"
        : "sent";

  // Keep every collected/manual payment; rebuild only the advance entry so
  // it always equals the advance on the order (it may have been edited).
  const otherPayments = (existing?.payments ?? []).filter((p) => p.kind !== "advance");
  const previousAdvance = (existing?.payments ?? []).find((p) => p.kind === "advance");
  const payments: InvoicePayment[] = [
    ...(order.advance > 0
      ? [
          {
            kind: "advance" as const,
            amount: order.advance,
            method: (previousAdvance?.method ?? "other") as PaymentMethod,
            note: "Advance",
            paidAt: previousAdvance?.paidAt ?? order.date,
            recordedBy: previousAdvance?.recordedBy ?? (actor.sub as never),
          },
        ]
      : []),
    ...otherPayments,
  ];

  const stageHistory = stage
    ? [
        ...(existing?.stageHistory ?? []).filter((entry) => entry.stage !== stage),
        { stage, at: new Date(), total: order.total, amountPaid },
      ]
    : (existing?.stageHistory ?? []);

  const fields = {
    source: kind as OrderKind,
    [field]: orderId,
    customer: order.customer,
    billTo: order.billTo,
    lineItems: order.lineItems,
    subtotal: order.total,
    discountAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    securityDeposit: 0,
    total: order.total,
    amountPaid,
    amountDue,
    status,
    payments,
    dueDate: order.date,
    bookingStage: stage ?? existing?.bookingStage,
    stageHistory,
    // Trashing/restoring the order trashes/restores its invoice too.
    deletedAt: order.deleted ? (existing?.deletedAt ?? new Date()) : null,
  };

  if (existing) {
    return Invoice.findByIdAndUpdate(existing._id, fields, { returnDocument: "after" });
  }

  const invoice = await Invoice.create({
    ...fields,
    invoiceNumber: await generateInvoiceNumber(),
    issuedAt: new Date(),
    notes: `Bill ${order.billNumber} — ${kind === "sale" ? "Dress sale" : "Customisation order"}`,
  });
  await recordAuditLog({
    entityType: "Invoice",
    entityId: String(invoice._id),
    action: "create",
    actor,
    snapshot: invoice.toObject() as unknown as Record<string, unknown>,
    metadata: { [kind === "sale" ? "fromSale" : "fromCustomisation"]: order.billNumber },
  });
  return invoice;
}

/** Best-effort sync — an invoice hiccup must never fail the order save. */
export async function syncOrderInvoiceSafely(
  kind: OrderKind,
  orderId: string,
  actor: AccessTokenPayload,
  stage?: string
): Promise<void> {
  try {
    await syncOrderInvoice(kind, orderId, actor, stage);
  } catch (error) {
    console.error(`Failed to sync invoice for ${kind} ${orderId}`, error);
  }
}

/** Order permanently deleted → its invoice goes too. */
export async function deleteOrderInvoices(kind: OrderKind, orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  await Invoice.deleteMany({ [LINK_FIELD[kind]]: { $in: orderIds } });
}

export interface CollectPaymentInput {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export type CollectPaymentResult =
  | { ok: true; invoiceId: string; dueAmount: number }
  | { ok: false; status: number; message: string };

/**
 * Records a payment made after the advance ("Due Paid"): updates the
 * order's paid/due amounts and logs the payment on its invoice. For a
 * customisation order, `markDelivered` also moves it to Delivered.
 */
export async function collectOrderPayment(
  kind: OrderKind,
  orderId: string,
  input: CollectPaymentInput,
  actor: AccessTokenPayload,
  options: { markDelivered?: boolean } = {}
): Promise<CollectPaymentResult> {
  const doc =
    kind === "sale"
      ? await Sale.findById(orderId)
      : await CustomisationOrder.findById(orderId);
  if (!doc || doc.deletedAt || ("source" in doc && doc.source === "booking")) {
    return { ok: false, status: 404, message: "Order not found" };
  }
  if ("status" in doc && doc.status === "cancelled") {
    return { ok: false, status: 409, message: "This order is cancelled" };
  }

  const total = doc.totalAmount ?? 0;
  const advance = doc.advancePayment ?? 0;
  const duePaidBefore = doc.duePaid ?? 0;
  const dueBefore = Math.max(0, total - advance - duePaidBefore);
  const amount = Math.round(input.amount * 100) / 100;

  if (amount > dueBefore + 0.001) {
    return {
      ok: false,
      status: 422,
      message: `Payment exceeds the amount due (₹${dueBefore.toLocaleString("en-IN")})`,
    };
  }

  const duePaidAfter = duePaidBefore + Math.max(0, amount);
  const dueAfter = Math.max(0, total - advance - duePaidAfter);
  // Targeted update rather than doc.save(): older records can be missing
  // fields the schema now requires, which would fail a full re-validate.
  const update: Record<string, unknown> = { duePaid: duePaidAfter, dueAmount: dueAfter };
  if (options.markDelivered && kind === "customisation") update.status = "delivered";
  if (kind === "sale") {
    await Sale.updateOne({ _id: orderId }, { $set: update });
  } else {
    await CustomisationOrder.updateOne({ _id: orderId }, { $set: update });
  }

  // Make sure the invoice exists, then log the payment on it.
  const invoice = await syncOrderInvoice(kind, orderId, actor);
  if (!invoice) return { ok: false, status: 404, message: "Order not found" };

  if (amount > 0) {
    await Invoice.findByIdAndUpdate(invoice._id, {
      $push: {
        payments: {
          kind: "due",
          amount,
          method: input.method,
          reference: input.reference,
          note: input.note || (options.markDelivered ? "Paid at delivery" : "Due paid"),
          paidAt: new Date(),
          recordedBy: actor.sub,
        },
      },
    });
  }

  const stage = options.markDelivered ? "delivered" : "payment";
  const updated = await syncOrderInvoice(kind, orderId, actor, stage);

  await recordAuditLog({
    entityType: kind === "sale" ? "Sale" : "CustomisationOrder",
    entityId: orderId,
    action: "update",
    actor,
    changes: [
      { field: "duePaid", from: duePaidBefore, to: duePaidAfter },
      { field: "dueAmount", from: dueBefore, to: dueAfter },
    ],
    metadata: { payment: input, markDelivered: Boolean(options.markDelivered) },
  });

  if (amount > 0 && updated) {
    void notifyPaymentReceived({
      customerName: doc.customerName,
      customerPhone: doc.customerPhone,
      relatedEntityType: "Invoice",
      relatedEntityId: String(updated._id),
      variables: {
        invoiceNumber: updated.invoiceNumber,
        amountPaid: String(amount),
        amountDue: String(updated.amountDue),
      },
    });
  }

  return { ok: true, invoiceId: String(invoice._id), dueAmount: dueAfter };
}
