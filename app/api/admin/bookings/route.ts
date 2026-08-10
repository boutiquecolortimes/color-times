import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { bookingCreateSchema } from "@/lib/validations/booking";
import { generateBookingNumber } from "@/lib/admin/booking-number";
import { findBookingConflicts } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { escapeRegex } from "@/lib/utils";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const all = searchParams.get("all") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "5")));
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search")?.trim();
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;
  // "view" (trash/active) is intentionally separate from "status" above —
  // status is the booking lifecycle (inquiry/confirmed/...), this is purely
  // whether the booking has been moved to Trash.
  const view = searchParams.get("view") === "trash" ? "trash" : "active";

  const filter: Record<string, unknown> = {
    deletedAt: view === "trash" ? { $ne: null } : null,
  };
  // "new" is a virtual tab collapsing the two pre-confirmation statuses —
  // there's no single stored value for it.
  if (status === "new") {
    filter.status = { $in: ["inquiry", "pending_payment"] };
  } else if (status && status !== "all") {
    filter.status = status;
  }
  // Supports a one-sided range too (just "from" or just "to"), not only both —
  // matches any booking whose rental period overlaps the given window.
  if (from) {
    filter.rentalEndDate = { $gte: new Date(from) };
  }
  if (to) {
    filter.rentalStartDate = { $lte: new Date(to) };
  }
  if (search) {
    // Matches booking/bill number directly, plus customer name/email/phone
    // and dress name/code via id lookups — one box searches everything.
    const regex = new RegExp(escapeRegex(search), "i");
    const [matchingCustomers, matchingProducts] = await Promise.all([
      User.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] })
        .select("_id")
        .lean(),
      Product.find({ $or: [{ name: regex }, { sku: regex }] })
        .select("_id")
        .lean(),
    ]);
    filter.$or = [
      { bookingNumber: regex },
      { billNumber: regex },
      { customer: { $in: matchingCustomers.map((c) => c._id) } },
      { "items.product": { $in: matchingProducts.map((p) => p._id) } },
    ];
  }

  const SORTABLE_FIELDS: Record<string, string> = {
    bookingNumber: "bookingNumber",
    bookingDate: "bookingDate",
    rentalStartDate: "rentalStartDate",
    totalAmount: "totalAmount",
    securityDeposit: "securityDeposit",
    advancePaid: "advancePaid",
    status: "status",
    createdAt: "createdAt",
  };
  const sortField = SORTABLE_FIELDS[sortBy] ?? "createdAt";

  const baseQuery = Booking.find(filter)
    .populate("customer", "name email")
    .populate("items.product", "name images")
    .sort({ [sortField]: sortDir, createdAt: -1 });

  // Tab counts (and the earnings summary) ignore the "status" filter itself
  // so every tab can show its own count regardless of which one is active —
  // they still respect search/date/trash-view filters.
  const countFilter: Record<string, unknown> = { ...filter };
  delete countFilter.status;

  const [bookings, total, summaryAgg, statusAgg] = await Promise.all([
    all ? baseQuery.lean() : baseQuery.skip((page - 1) * pageSize).limit(pageSize).lean(),
    Booking.countDocuments(filter),
    // Earnings summary is computed over every booking matching the current
    // filter (not just the current page) so it reflects the store's real
    // totals, not just what's visible in the table.
    Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" },
          securityDeposit: { $sum: "$securityDeposit" },
          advancePaid: { $sum: "$advancePaid" },
        },
      },
    ]),
    Booking.aggregate([
      { $match: countFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const summaryRow = summaryAgg[0] ?? { totalAmount: 0, securityDeposit: 0, advancePaid: 0 };
  const summary = {
    totalAmount: summaryRow.totalAmount,
    securityDeposit: summaryRow.securityDeposit,
    advancePaid: summaryRow.advancePaid,
    dueAmount: summaryRow.totalAmount - summaryRow.advancePaid,
  };

  const rawStatusCounts: Record<string, number> = {};
  for (const row of statusAgg as { _id: string; count: number }[]) {
    rawStatusCounts[row._id] = row.count;
  }
  const statusCounts = {
    all: Object.values(rawStatusCounts).reduce((sum, count) => sum + count, 0),
    new: (rawStatusCounts.inquiry ?? 0) + (rawStatusCounts.pending_payment ?? 0),
    confirmed: rawStatusCounts.confirmed ?? 0,
    in_use: rawStatusCounts.in_use ?? 0,
    returned: rawStatusCounts.returned ?? 0,
    cancelled: rawStatusCounts.cancelled ?? 0,
  };

  // Older bookings predate the bookingDate/advancePaid fields, so a plain
  // .lean() read can leave them missing on the stored document — normalize
  // here instead of letting every consumer guess.
  const normalizedBookings = bookings.map((booking) => ({
    ...booking,
    bookingDate: booking.bookingDate ?? booking.createdAt ?? new Date(),
    advancePaid: booking.advancePaid ?? 0,
  }));

  return apiSuccess({
    bookings: normalizedBookings,
    pagination: all
      ? { page: 1, pageSize: total || 1, total, totalPages: 1 }
      : { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    summary,
    statusCounts,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bookingCreateSchema.parse(body);

    await connectToDatabase();

    const rentalStartDate = new Date(input.rentalStartDate);
    const rentalEndDate = new Date(input.rentalEndDate);

    const items = [];

    for (const inputItem of input.items) {
      const product = await Product.findById(inputItem.product).lean();
      if (!product) {
        return apiError("One of the selected dresses could not be found", 404);
      }

      const conflicts = await findBookingConflicts(inputItem.product, rentalStartDate, rentalEndDate);
      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        return apiError(
          `${product.name} is already booked (${conflict.bookingNumber}) from ${conflict.rentalStartDate.toDateString()} to ${conflict.rentalEndDate.toDateString()}`,
          409
        );
      }

      // Size/quantity aren't collected in the booking form — one unit of the
      // product's first listed size. Color and rent are editable per line in
      // the form and fall back to the product's own values when omitted.
      const quantity = 1;
      const size = product.variants[0]?.size ?? "Custom";
      const color = inputItem.color || product.color;
      const pricePerDay = inputItem.pricePerDay ?? product.rentalPricePerDay;
      // Flat rent for the whole booking — not multiplied by rental days.
      const rentalFee = pricePerDay * quantity;

      items.push({
        product: inputItem.product,
        color,
        size,
        quantity,
        pricePerDay,
        rentalFee,
        wearerName: inputItem.wearerName || undefined,
        measurements: inputItem.measurements,
      });
    }

    // Suggested deposit is 30% of the total rent across all items — not a sum
    // of each dress's own deposit, which overcharged multi-item bookings
    // (e.g. 5 dresses previously meant 5x the deposit). Still overridable
    // from the form.
    const totalRent = items.reduce((sum, item) => sum + item.rentalFee, 0);
    const suggestedSecurityDeposit = Math.round(totalRent * 0.3);
    const securityDeposit = input.securityDeposit ?? suggestedSecurityDeposit;
    const totalAmount = items.reduce((sum, item) => sum + item.rentalFee, 0) + securityDeposit;
    const bookingNumber = await generateBookingNumber();

    const booking = await Booking.create({
      bookingNumber,
      billNumber: input.billNumber || undefined,
      bookingDate: new Date(input.bookingDate),
      customer: input.customer,
      items,
      rentalStartDate,
      rentalEndDate,
      // No longer collected in the form — defaults to the pickup date.
      eventDate: input.eventDate ? new Date(input.eventDate) : rentalStartDate,
      // Any advance received means the customer has committed — skip the
      // "inquiry" stage and go straight to Confirmed instead of making
      // staff manually flip it after every booking with a deposit.
      status: (input.advancePaid ?? 0) > 0 ? "confirmed" : "inquiry",
      securityDeposit,
      totalAmount,
      advancePaid: input.advancePaid ?? 0,
      advancePaymentMethod: input.advancePaymentMethod || undefined,
      measurements: input.measurements,
      deliveryAddress: input.deliveryAddress,
      notes: input.notes || undefined,
    });

    await recordAuditLog({
      entityType: "Booking",
      entityId: String(booking._id),
      action: "create",
      actor: auth.user,
      snapshot: booking.toObject() as unknown as Record<string, unknown>,
    });

    const populated = await Booking.findById(booking._id)
      .populate("customer", "name email")
      .populate("items.product", "name images")
      .lean();

    return apiSuccess({ booking: populated }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
