import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/Booking";
import "@/models/User";
import "@/models/Sale";
import "@/models/CustomisationOrder";
import { getInvoiceTypeCounts } from "@/lib/admin/invoice-types";
import { InvoicesClient } from "@/components/admin/invoices-client";

export const metadata: Metadata = { title: "Invoices" };

const PAGE_SIZE = 5;

export default async function AdminInvoicesPage() {
  await connectToDatabase();

  const activeFilter = { deletedAt: null };

  const [invoices, total, typeCounts] = await Promise.all([
    Invoice.find(activeFilter)
      .populate("customer", "name email phone")
      .populate("booking", "bookingNumber")
      .populate("sale", "billNumber")
      .populate("customisationOrder", "billNumber")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean(),
    Invoice.countDocuments(activeFilter),
    getInvoiceTypeCounts(activeFilter),
  ]);

  const initialInvoices = invoices.map((invoice) => ({
    _id: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    // A handful of invoices predate later schema additions or were bulk-
    // imported outside the app — .lean() doesn't backfill schema defaults,
    // so these can still be missing on the stored document.
    subtotal: invoice.subtotal ?? 0,
    discountAmount: invoice.discountAmount ?? 0,
    taxAmount: invoice.taxAmount ?? 0,
    securityDeposit: invoice.securityDeposit ?? 0,
    depositRefunded: invoice.depositRefunded ?? false,
    total: invoice.total ?? 0,
    amountPaid: invoice.amountPaid ?? 0,
    amountDue: invoice.amountDue ?? 0,
    dueDate: (invoice.dueDate ?? invoice.createdAt ?? new Date()).toISOString(),
    createdAt: (invoice.createdAt ?? new Date()).toISOString(),
    customer: invoice.customer
      ? {
          name: (invoice.customer as unknown as { name: string }).name,
          email: (invoice.customer as unknown as { email: string }).email,
          phone: (invoice.customer as unknown as { phone?: string }).phone,
        }
      : null,
    billTo: invoice.billTo ? { name: invoice.billTo.name, phone: invoice.billTo.phone } : null,
    source: invoice.source,
    sale: invoice.sale
      ? {
          _id: String((invoice.sale as unknown as { _id: unknown })._id),
          billNumber: (invoice.sale as unknown as { billNumber: string }).billNumber,
        }
      : null,
    customisationOrder: invoice.customisationOrder
      ? {
          _id: String((invoice.customisationOrder as unknown as { _id: unknown })._id),
          billNumber: (invoice.customisationOrder as unknown as { billNumber: string }).billNumber,
        }
      : null,
    booking: invoice.booking
      ? { bookingNumber: (invoice.booking as unknown as { bookingNumber: string }).bookingNumber }
      : null,
  }));

  return (
    <InvoicesClient
      initialInvoices={initialInvoices}
      initialTypeCounts={typeCounts}
      initialPagination={{
        page: 1,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
    />
  );
}
