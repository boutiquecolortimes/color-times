import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/models/Invoice";
import "@/models/User";
import { generateInvoicePdfBuffer } from "@/lib/admin/invoice-pdf-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await connectToDatabase();

    const invoice = await Invoice.findById(id).populate("customer", "name email phone").lean();
    if (!invoice || invoice.deletedAt) {
      return new Response("Not found", { status: 404 });
    }

    const customer = invoice.customer as unknown as {
      name: string;
      email: string;
      phone?: string;
    } | null;
    if (!customer) {
      return new Response("This invoice's customer record is missing.", { status: 422 });
    }

    // A handful of invoices predate later schema additions or were
    // inserted outside the app (bulk import), so numeric/date fields the
    // schema marks "required" can still be missing on the stored document —
    // formatCurrency()'s .toLocaleString() call would throw on undefined
    // (the same crash class that hit the Sale list page earlier), so
    // normalize before generating rather than let a bad legacy record 500
    // the one link that's shared straight to a customer.
    const buffer = await generateInvoicePdfBuffer({
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      createdAt: invoice.createdAt ?? new Date(),
      dueDate: invoice.dueDate ?? invoice.createdAt ?? new Date(),
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      lineItems: invoice.lineItems ?? [],
      subtotal: invoice.subtotal ?? 0,
      discountAmount: invoice.discountAmount ?? 0,
      taxRate: invoice.taxRate ?? 0,
      taxAmount: invoice.taxAmount ?? 0,
      securityDeposit: invoice.securityDeposit ?? 0,
      total: invoice.total ?? 0,
      amountPaid: invoice.amountPaid ?? 0,
      amountDue: invoice.amountDue ?? 0,
      payments: invoice.payments ?? [],
      notes: invoice.notes,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate invoice PDF:", error);
    return new Response("Unable to generate this invoice's PDF right now.", { status: 500 });
  }
}
