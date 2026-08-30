import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/Booking";
import "@/models/User";
import { invoiceSchema, computeInvoiceTotals } from "@/lib/validations/invoice";
import { generateInvoiceNumber } from "@/lib/admin/invoice-number";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const SORTABLE_FIELDS = new Set(["invoiceNumber", "total", "amountDue", "amountPaid", "dueDate", "createdAt", "status", "deletedAt"]);

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const all = searchParams.get("all") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const status = searchParams.get("status");
  const view = searchParams.get("view") ?? "active";
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;

  const filter: Record<string, unknown> = view === "trash" ? { deletedAt: { $ne: null } } : { deletedAt: null };

  if (status && status !== "all") {
    filter.status = status;
  }
  if (search) {
    filter.invoiceNumber = { $regex: search, $options: "i" };
  }

  const sortField = SORTABLE_FIELDS.has(sortBy) ? sortBy : "createdAt";

  const baseQuery = Invoice.find(filter)
    .populate("customer", "name email phone")
    .populate("booking", "bookingNumber")
    .sort({ [sortField]: sortDir });

  const [invoices, total] = await Promise.all([
    all ? baseQuery.lean() : baseQuery.skip((page - 1) * pageSize).limit(pageSize).lean(),
    Invoice.countDocuments(filter),
  ]);

  return apiSuccess({
    invoices,
    pagination: all
      ? { page: 1, pageSize: total || 1, total, totalPages: 1 }
      : { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = invoiceSchema.parse(body);

    await connectToDatabase();

    if (input.booking) {
      const existing = await Invoice.findOne({
        booking: input.booking,
        deletedAt: null,
        status: { $ne: "cancelled" },
      }).lean();
      if (existing) {
        return apiError("This booking already has an active invoice", 409);
      }
    }

    const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(input);
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
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
      amountPaid: 0,
      amountDue: total,
      status: "draft",
      dueDate: new Date(input.dueDate),
      notes: input.notes,
    });

    await recordAuditLog({
      entityType: "Invoice",
      entityId: String(invoice._id),
      action: "create",
      actor: auth.user,
      snapshot: invoice.toObject() as unknown as Record<string, unknown>,
    });

    return apiSuccess({ invoice }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
