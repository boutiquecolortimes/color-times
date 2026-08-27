import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { Invoice } from "@/models/Invoice";
import { Staff } from "@/models/Staff";
import { SalaryPayment } from "@/models/SalaryPayment";
import { Purchase } from "@/models/Purchase";
import { Expense } from "@/models/Expense";
import { requireApiRole } from "@/lib/api/require-role";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { apiSuccess } from "@/lib/api/response";

export async function GET(): Promise<Response> {
  const auth = await requireApiRole(ADMIN_ROLES);
  if ("error" in auth) return auth.error;

  await connectToDatabase();

  const trashed = { deletedAt: { $ne: null } };
  const [products, categories, bookings, customers, invoices, staff, salaryPayments, purchases, expenses] =
    await Promise.all([
      Product.countDocuments(trashed),
      Category.countDocuments(trashed),
      Booking.countDocuments(trashed),
      User.countDocuments({ ...trashed, role: "customer" }),
      Invoice.countDocuments(trashed),
      Staff.countDocuments(trashed),
      SalaryPayment.countDocuments(trashed),
      Purchase.countDocuments(trashed),
      Expense.countDocuments(trashed),
    ]);

  return apiSuccess({
    counts: {
      products,
      categories,
      bookings,
      customers,
      invoices,
      staff,
      salaryPayments,
      purchases,
      expenses,
    },
  });
}
