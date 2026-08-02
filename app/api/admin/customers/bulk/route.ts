import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Invoice } from "@/models/Invoice";
import { Review } from "@/models/Review";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog } from "@/lib/audit/log";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

const bulkCustomerActionSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one customer"),
  action: z.enum(["delete", "restore", "permanent-delete"]),
});

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const input = bulkCustomerActionSchema.parse(body);

    await connectToDatabase();

    if (input.action === "permanent-delete") {
      const customers = await User.find({
        _id: { $in: input.ids },
        role: "customer",
        deletedAt: { $ne: null },
      }).lean();
      if (customers.length === 0) {
        return apiError("No trashed items found among the selected customers", 404);
      }

      const customerIds = customers.map((c) => c._id);
      const [bookingCounts, invoiceCounts, reviewCounts] = await Promise.all([
        Booking.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $group: { _id: "$customer", count: { $sum: 1 } } },
        ]),
        Invoice.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $group: { _id: "$customer", count: { $sum: 1 } } },
        ]),
        Review.aggregate([
          { $match: { customer: { $in: customerIds } } },
          { $group: { _id: "$customer", count: { $sum: 1 } } },
        ]),
      ]);
      const bookingByCustomer = new Map<string, number>(
        bookingCounts.map((row) => [String(row._id), row.count as number])
      );
      const invoiceByCustomer = new Map<string, number>(
        invoiceCounts.map((row) => [String(row._id), row.count as number])
      );
      const reviewByCustomer = new Map<string, number>(
        reviewCounts.map((row) => [String(row._id), row.count as number])
      );

      const deletable = customers.filter((c) => {
        const id = String(c._id);
        return !bookingByCustomer.has(id) && !invoiceByCustomer.has(id) && !reviewByCustomer.has(id);
      });
      const blocked = customers
        .filter((c) => {
          const id = String(c._id);
          return bookingByCustomer.has(id) || invoiceByCustomer.has(id) || reviewByCustomer.has(id);
        })
        .map((c) => ({
          name: c.name,
          bookingCount: bookingByCustomer.get(String(c._id)) ?? 0,
          invoiceCount: invoiceByCustomer.get(String(c._id)) ?? 0,
          reviewCount: reviewByCustomer.get(String(c._id)) ?? 0,
        }));

      if (deletable.length > 0) {
        await User.deleteMany({ _id: { $in: deletable.map((c) => c._id) } });

        await recordAuditLog({
          entityType: "Customer",
          entityId: "bulk",
          action: "bulk_delete",
          actor: auth.user,
          metadata: {
            permanent: true,
            count: deletable.length,
            ids: deletable.map((c) => String(c._id)),
          },
        });
      }

      return apiSuccess({ deleted: deletable.length, blocked });
    }

    // "delete" (soft, move to Trash) and "restore" just toggle deletedAt +
    // isActive — no reference check needed, same as Categories/Bookings.
    const update =
      input.action === "delete"
        ? { deletedAt: new Date(), isActive: false }
        : { deletedAt: null, isActive: true };
    const result = await User.updateMany(
      { _id: { $in: input.ids }, role: "customer" },
      update
    );

    await recordAuditLog({
      entityType: "Customer",
      entityId: "bulk",
      action: input.action === "delete" ? "bulk_delete" : "bulk_update",
      actor: auth.user,
      metadata: { action: input.action, count: result.modifiedCount, ids: input.ids },
    });

    return apiSuccess({ affected: result.modifiedCount });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
