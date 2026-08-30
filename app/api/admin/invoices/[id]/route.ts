import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/Booking";
import "@/models/User";
import { invoiceSchema, computeInvoiceTotals } from "@/lib/validations/invoice";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const invoice = await Invoice.findById(id)
    .populate("customer", "name email phone addresses")
    .populate("booking", "bookingNumber rentalStartDate rentalEndDate")
    .populate("payments.recordedBy", "name")
    .lean();

  if (!invoice) {
    return apiError("Invoice not found", 404);
  }

  return apiSuccess({ invoice });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(MANAGER_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = invoiceSchema.parse(body);

    await connectToDatabase();

    const before = await Invoice.findById(id).lean();
    if (!before) {
      return apiError("Invoice not found", 404);
    }
    if (before.status !== "draft") {
      return apiError("Only draft invoices can be edited", 409);
    }

    const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(input);

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      {
        customer: input.customer,
        booking: input.booking || null,
        lineItems: input.lineItems.map((item) => ({
          ...item,
          amount: item.quantity * item.unitPrice,
        })),
        subtotal,
        discountAmount,
        taxRate: input.taxRate,
        taxAmount,
        securityDeposit: input.securityDeposit,
        total,
        amountDue: total - before.amountPaid,
        dueDate: new Date(input.dueDate),
        notes: input.notes,
      },
      { returnDocument: "after" }
    );

    if (!invoice) {
      return apiError("Invoice not found", 404);
    }

    const changes = diffObjects(
      before as unknown as Record<string, unknown>,
      invoice.toObject() as unknown as Record<string, unknown>
    );

    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "Invoice",
        entityId: id,
        action: "update",
        actor: auth.user,
        changes,
      });
    }

    return apiSuccess({ invoice });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const existing = await Invoice.findById(id).lean();
  if (!existing) {
    return apiError("Invoice not found", 404);
  }
  if (existing.status !== "draft" && existing.status !== "cancelled") {
    return apiError("Only draft or cancelled invoices can be deleted", 409);
  }

  const invoice = await Invoice.findByIdAndUpdate(id, { deletedAt: new Date() }, { returnDocument: "after" });

  await recordAuditLog({
    entityType: "Invoice",
    entityId: id,
    action: "delete",
    actor: auth.user,
    snapshot: invoice?.toObject() as unknown as Record<string, unknown>,
  });

  return apiSuccess({ deleted: true });
}
