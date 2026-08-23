import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/Booking";
import "@/models/User";
import { InvoicesClient } from "@/components/admin/invoices-client";

export const metadata: Metadata = { title: "Invoices" };

const PAGE_SIZE = 5;

export default async function AdminInvoicesPage() {
  await connectToDatabase();

  const activeFilter = { deletedAt: null };

  const [invoices, total] = await Promise.all([
    Invoice.find(activeFilter)
      .populate("customer", "name email phone")
      .populate("booking", "bookingNumber")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    Invoice.countDocuments(activeFilter),
  ]);

  const initialInvoices = invoices.map((invoice) => ({
    _id: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    amountDue: invoice.amountDue,
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    customer: invoice.customer
      ? {
          name: (invoice.customer as unknown as { name: string }).name,
          email: (invoice.customer as unknown as { email: string }).email,
          phone: (invoice.customer as unknown as { phone?: string }).phone,
        }
      : null,
    booking: invoice.booking
      ? { bookingNumber: (invoice.booking as unknown as { bookingNumber: string }).bookingNumber }
      : null,
  }));

  return (
    <InvoicesClient
      initialInvoices={initialInvoices}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
    />
  );
}
