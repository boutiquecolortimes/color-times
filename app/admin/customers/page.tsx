import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/models/User";
import { CustomersClient } from "@/components/admin/customers-client";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 5;

export default async function AdminCustomersPage() {
  await connectToDatabase();

  const [customers, total] = await Promise.all([
    User.find({ role: "customer", deletedAt: null })
      .select("name email phone createdAt")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    User.countDocuments({ role: "customer", deletedAt: null }),
  ]);

  const initialCustomers = customers.map((customer) => ({
    _id: String(customer._id),
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? null,
    createdAt: customer.createdAt.toISOString(),
  }));

  return (
    <CustomersClient
      initialCustomers={initialCustomers}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
    />
  );
}
