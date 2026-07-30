import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Booking } from "@/models/Booking";
import { Product } from "@/models/Product";
import "@/models/User";
import { bookingCreateSchema } from "@/lib/validations/booking";
import { generateBookingNumber } from "@/lib/admin/booking-number";
import { findBookingConflicts } from "@/lib/admin/booking-availability";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { daysBetween } from "@/lib/utils";

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const filter: Record<string, unknown> = {};
  if (status) {
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

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("customer", "name email")
      .populate("items.product", "name images")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return apiSuccess({
    bookings,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
    const days = daysBetween(rentalStartDate, rentalEndDate);

    const items = [];
    let securityDeposit = 0;

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

      const pricePerDay = product.rentalPricePerDay;
      const rentalFee = pricePerDay * days * inputItem.quantity;
      securityDeposit += product.securityDeposit * inputItem.quantity;

      items.push({
        product: inputItem.product,
        size: inputItem.size,
        quantity: inputItem.quantity,
        pricePerDay,
        rentalFee,
      });
    }

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
      eventDate: new Date(input.eventDate),
      status: "inquiry",
      securityDeposit,
      totalAmount,
      advancePaid: input.advancePaid ?? 0,
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
