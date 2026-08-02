import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Invoice } from "@/models/Invoice";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiErrorFromUnknown } from "@/lib/api/response";

const RESULT_LIMIT = 6;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return apiSuccess({ products: [], customers: [], bookings: [], invoices: [] });
  }

  try {
    await connectToDatabase();

    const pattern = escapeRegex(q);
    const regex = { $regex: pattern, $options: "i" };

    const [products, customers, bookings, invoices] = await Promise.all([
      Product.find({ $or: [{ name: regex }, { sku: regex }], deletedAt: null })
        .select("name sku images")
        .limit(RESULT_LIMIT)
        .lean(),
      User.find({ role: "customer", deletedAt: null, $or: [{ name: regex }, { phone: regex }] })
        .select("name email phone")
        .limit(RESULT_LIMIT)
        .lean(),
      Booking.find({ bookingNumber: regex })
        .populate("customer", "name")
        .select("bookingNumber status customer")
        .limit(RESULT_LIMIT)
        .lean(),
      Invoice.find({ invoiceNumber: regex })
        .populate("customer", "name")
        .select("invoiceNumber status customer")
        .limit(RESULT_LIMIT)
        .lean(),
    ]);

    return apiSuccess({
      products: products.map((p) => ({
        _id: String(p._id),
        name: p.name,
        sku: p.sku,
        image: p.images?.[0] ?? null,
      })),
      customers: customers.map((c) => ({
        _id: String(c._id),
        name: c.name,
        email: c.email,
        phone: c.phone ?? null,
      })),
      bookings: bookings.map((b) => ({
        _id: String(b._id),
        bookingNumber: b.bookingNumber,
        status: b.status,
        customerName: (b.customer as unknown as { name: string } | null)?.name ?? null,
      })),
      invoices: invoices.map((i) => ({
        _id: String(i._id),
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        customerName: (i.customer as unknown as { name: string } | null)?.name ?? null,
      })),
    });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
