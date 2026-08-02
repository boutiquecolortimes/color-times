import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import "@/models/Product";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordAuditLog, diffObjects } from "@/lib/audit/log";
import { customerUpdateSchema } from "@/lib/validations/customer";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const [customer, bookings] = await Promise.all([
    User.findById(id).select("name email phone fatherName addresses isActive createdAt").lean(),
    Booking.find({ customer: id })
      .populate("items.product", "name images")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!customer) {
    return apiError("Customer not found", 404);
  }

  return apiSuccess({ customer, bookings });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const input = customerUpdateSchema.parse(body);

    await connectToDatabase();

    const before = await User.findById(id).select("name phone fatherName addresses").lean();
    if (!before) {
      return apiError("Customer not found", 404);
    }

    const hasAddressInput = Boolean(
      input.addressLine1 || input.addressCity || input.addressState || input.addressPostalCode
    );

    const addresses = [...(before.addresses ?? [])];
    if (hasAddressInput) {
      const existing = addresses[0];
      addresses[0] = {
        label: existing?.label ?? "Home",
        line1: input.addressLine1 ?? existing?.line1 ?? "",
        line2: existing?.line2,
        city: input.addressCity ?? existing?.city ?? "",
        state: input.addressState ?? existing?.state ?? "",
        postalCode: input.addressPostalCode ?? existing?.postalCode ?? "",
        isDefault: existing?.isDefault ?? true,
      };
    }

    const customer = await User.findByIdAndUpdate(
      id,
      {
        name: input.name,
        phone: input.phone,
        fatherName: input.fatherName,
        addresses,
      },
      { returnDocument: "after" }
    ).select("name email phone fatherName addresses createdAt");

    if (!customer) {
      return apiError("Customer not found", 404);
    }

    const changes = diffObjects(
      before as unknown as Record<string, unknown>,
      customer.toObject() as unknown as Record<string, unknown>
    );

    if (changes.length > 0) {
      await recordAuditLog({
        entityType: "Customer",
        entityId: id,
        action: "update",
        actor: auth.user,
        changes,
      });
    }

    return apiSuccess({ customer });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

// Soft delete — moves the customer to Trash instead of erasing the account.
// Also deactivates login (isActive: false) so a trashed customer can't sign
// in and place new orders while their account is out of the active list.
// Reversible via restore; only Trash -> Permanent Delete actually erases it.
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await connectToDatabase();

  const customer = await User.findOneAndUpdate(
    { _id: id, role: "customer" },
    { deletedAt: new Date(), isActive: false },
    { returnDocument: "after" }
  );
  if (!customer) {
    return apiError("Customer not found", 404);
  }

  await recordAuditLog({
    entityType: "Customer",
    entityId: id,
    action: "delete",
    actor: auth.user,
  });

  return apiSuccess({ deleted: true });
}
