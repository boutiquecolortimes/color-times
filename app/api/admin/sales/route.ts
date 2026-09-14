import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { saleSchema, computeSaleDue } from "@/lib/validations/sale";
import { findUpcomingBookingForProduct } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const view = searchParams.get("view") ?? "active";
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;
  const SORTABLE_FIELDS: Record<string, string> = {
    billNumber: "billNumber",
    customerName: "customerName",
    totalAmount: "totalAmount",
    advancePayment: "advancePayment",
    dueAmount: "dueAmount",
    saleDate: "saleDate",
    createdAt: "createdAt",
  };
  const sort = sortBy && SORTABLE_FIELDS[sortBy]
    ? { [SORTABLE_FIELDS[sortBy]]: sortDir as 1 | -1 }
    : { createdAt: -1 as const };

  // Auto-generated "source: booking" entries are a duplicate ledger record
  // for a booking's own settlement (see models/Sale.ts) — they'd otherwise
  // show up here looking like real outright sales, so they're excluded from
  // this list the same way they're excluded from the Sale report's totals.
  const filter: Record<string, unknown> =
    view === "trash"
      ? { deletedAt: { $ne: null }, source: "manual" }
      : { deletedAt: null, source: "manual" };

  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate("product", "name images sku")
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Sale.countDocuments(filter),
  ]);

  // Sales created before advancePayment/dueAmount existed on the schema
  // don't have these stored on the document — .lean() reads don't backfill
  // schema defaults, so normalize here instead of letting every consumer
  // (and formatCurrency) choke on undefined.
  const normalizedSales = sales.map((sale) => ({
    ...sale,
    advancePayment: sale.advancePayment ?? 0,
    dueAmount: sale.dueAmount ?? 0,
  }));

  return apiSuccess({
    sales: normalizedSales,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = saleSchema.parse(body);

    await connectToDatabase();

    // A product already excluded from the Sale picker (Confirmed/Picked-up)
    // never reaches here, but an Inquiry-stage booking never touches
    // Product.status — so without this, staff could still sell a dress
    // outright that's already promised to someone else's upcoming booking.
    const conflict = await findUpcomingBookingForProduct(input.product);
    if (conflict) {
      return apiError(
        `This dress already has a booking (${conflict.bookingNumber}) from ${conflict.rentalStartDate.toDateString()} to ${conflict.rentalEndDate.toDateString()} — cancel that booking first before selling this dress outright`,
        409
      );
    }

    // Bill number is staff-entered (pre-filled with a suggested next
    // number, see nextSharedBillNumber()) but stays editable — same as
    // Booking — so it must be required and unique, guarded the same way.
    const duplicateBill = await Sale.findOne({
      billNumber: input.billNumber,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (duplicateBill) {
      return apiError(`Bill number ${input.billNumber} is already used by another sale`, 409);
    }

    const dueAmount = computeSaleDue(input);

    const sale = await Sale.create({
      billNumber: input.billNumber,
      saleDate: new Date(input.saleDate),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      customer: input.customer || undefined,
      product: input.product,
      details: input.details,
      totalAmount: input.totalAmount,
      advancePayment: input.advancePayment,
      dueAmount,
      source: "manual",
    });

    // This dress has been sold outright — take it out of rental circulation.
    // It stays in the normal Products list (not archived) but shows as Sold
    // and drops out of the booking/new-sale pickers.
    await Product.findByIdAndUpdate(input.product, { status: "sold" });

    await recordAuditLog({
      entityType: "Sale",
      entityId: String(sale._id),
      action: "create",
      actor: auth.user,
      snapshot: sale.toObject() as unknown as Record<string, unknown>,
    });

    return apiSuccess({ sale }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
