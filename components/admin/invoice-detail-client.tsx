"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceStatusBadge } from "@/components/admin/invoice-status-badge";
import { InvoicePaymentDialog } from "@/components/admin/invoice-payment-dialog";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AuditLogList } from "@/components/admin/audit-log-list";
import { downloadInvoicePdf } from "@/lib/admin/invoice-pdf";
import { getInvoiceDueBreakdown } from "@/lib/admin/invoice-totals";
import { formatDate, isWalkinEmail } from "@/lib/utils";
import type { InvoiceLineItem, InvoiceStatus, PaymentMethod } from "@/models/Invoice";

interface PaymentRow {
  _id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  paidAt: string;
  recordedByName: string;
}

interface InvoiceDetail {
  _id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  customer: { name: string; email: string; phone?: string };
  booking: { bookingNumber: string } | null;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  securityDeposit: number;
  depositRefunded: boolean;
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string;
  issuedAt: string | null;
  createdAt: string;
  notes?: string;
  payments: PaymentRow[];
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

interface RawInvoicePayment {
  _id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  paidAt: string;
  recordedBy: { name: string } | null;
}

async function fetchInvoice(id: string): Promise<InvoiceDetail> {
  const res = await fetch(`/api/admin/invoices/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  const invoice = json.data.invoice;
  return {
    ...invoice,
    // The customer can be permanently deleted while this invoice stays in
    // the system as a billing record — populate then comes back null.
    // Fall back the same way the initial server-rendered load already does
    // instead of crashing on refetch.
    customer: invoice.customer ?? { name: "—", email: "—" },
    payments: invoice.payments.map((payment: RawInvoicePayment) => ({
      _id: payment._id,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
      note: payment.note,
      paidAt: payment.paidAt,
      recordedByName: payment.recordedBy?.name ?? "—",
    })),
  };
}

export function InvoiceDetailClient({ initialInvoice }: { initialInvoice: InvoiceDetail }) {
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "refund-deposit" | null>(null);

  const { data: invoice = initialInvoice } = useQuery({
    queryKey: ["admin", "invoice", initialInvoice._id],
    queryFn: () => fetchInvoice(initialInvoice._id),
    initialData: initialInvoice,
  });

  // The security deposit is usually collected and held separately from
  // what's logged as an invoice payment, so a single "Due" figure that
  // includes it reads as if the deposit is still owed even once it's
  // sitting in hand. Split it out so rent and deposit show separately.
  const due = getInvoiceDueBreakdown(invoice);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "invoice", initialInvoice._id] });
    queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
  }

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/invoices/${invoice._id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: () => {
      toast.success("Invoice sent");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/invoices/${invoice._id}/cancel`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: () => {
      toast.success("Invoice cancelled");
      invalidate();
      setConfirmAction(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refundDepositMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/invoices/${invoice._id}/refund-deposit`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.invoice;
    },
    onSuccess: () => {
      toast.success("Deposit marked as refunded");
      invalidate();
      setConfirmAction(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/invoices/${invoice._id}/remind`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => toast.success("Payment reminder sent"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl">{invoice.invoiceNumber}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {invoice.issuedAt ? formatDate(invoice.issuedAt) : "—"}{" "}
            &middot; Due {formatDate(invoice.dueDate)}
            {invoice.booking && <> &middot; Booking {invoice.booking.bookingNumber}</>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void downloadInvoicePdf({
                invoiceNumber: invoice.invoiceNumber,
                status: invoice.status,
                createdAt: invoice.createdAt,
                dueDate: invoice.dueDate,
                customer: invoice.customer,
                lineItems: invoice.lineItems,
                subtotal: invoice.subtotal,
                discountAmount: invoice.discountAmount,
                taxRate: invoice.taxRate,
                taxAmount: invoice.taxAmount,
                securityDeposit: invoice.securityDeposit,
                total: invoice.total,
                amountPaid: invoice.amountPaid,
                amountDue: invoice.amountDue,
                payments: invoice.payments,
                notes: invoice.notes,
              })
            }
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          {invoice.status === "draft" && (
            <Button size="sm" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              Send Invoice
            </Button>
          )}
          {["sent", "partially_paid", "overdue"].includes(invoice.status) && (
            <>
              <Button size="sm" onClick={() => setPaymentDialogOpen(true)}>
                Record Payment
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={remindMutation.isPending}
                onClick={() => remindMutation.mutate()}
              >
                {remindMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Send Reminder
              </Button>
            </>
          )}
          {invoice.status === "paid" && invoice.securityDeposit > 0 && !invoice.depositRefunded && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction("refund-deposit")}
            >
              Mark Deposit Refunded
            </Button>
          )}
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <Button size="sm" variant="destructive" onClick={() => setConfirmAction("cancel")}>
              Cancel Invoice
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Bill To</h2>
              <p className="mt-2 text-sm">{invoice.customer.name}</p>
              {invoice.customer.phone && (
                <p className="text-sm text-muted-foreground">{invoice.customer.phone}</p>
              )}
              {invoice.customer.email && !isWalkinEmail(invoice.customer.email) && (
                <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-secondary/40 p-6">
              <h2 className="font-heading text-lg">Summary</h2>
              <div className="mt-2 space-y-1 text-sm">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Rent</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatCurrency(invoice.discountAmount)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                  <span>{formatCurrency(invoice.taxAmount)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Security Deposit</span>
                  <span>
                    {formatCurrency(invoice.securityDeposit)}
                    {invoice.depositRefunded
                      ? " (refunded)"
                      : invoice.securityDeposit <= 0
                        ? ""
                        : due.securityDue <= 0
                          ? " (held)"
                          : due.securityDue < due.securityInTotal
                            ? ` (${formatCurrency(due.securityDue)} due)`
                            : " (due)"}
                  </span>
                </p>
                <p className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </p>
                <p className="flex justify-between text-emerald-700">
                  <span>Paid</span>
                  <span>{formatCurrency(invoice.amountPaid)}</span>
                </p>
                <p className="flex justify-between font-medium text-red-700">
                  <span>Rent Due</span>
                  <span>{formatCurrency(due.rentDue)}</span>
                </p>
                {due.securityDue > 0 && (
                  <p className="flex justify-between font-medium text-amber-700">
                    <span>Security Due</span>
                    <span>{formatCurrency(due.securityDue)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 lg:hidden">
            {invoice.lineItems.map((item, index) => (
              <div key={index} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-medium">{item.description}</p>
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {item.quantity} &times; {formatCurrency(item.unitPrice)}
                  </span>
                  <span className="font-medium text-foreground">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
            <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
              <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit Price</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="font-heading text-lg">Payment History</h2>
            {invoice.payments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <>
                <div className="mt-3 space-y-3 lg:hidden">
                  {invoice.payments.map((payment) => (
                    <div key={payment._id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(payment.paidAt)}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {METHOD_LABELS[payment.method]}
                        {payment.reference && ` · ${payment.reference}`}
                      </p>
                      <p className="text-xs text-muted-foreground">By {payment.recordedByName}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
                  <table className="w-full min-w-[640px] text-sm whitespace-nowrap">
                    <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((payment) => (
                        <tr key={payment._id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                          <td className="px-4 py-3">{METHOD_LABELS[payment.method]}</td>
                          <td className="px-4 py-3">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {payment.reference ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {payment.recordedByName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {invoice.notes && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="font-heading text-lg">Notes</h2>
              <p className="mt-2 text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <AuditLogList entityType="Invoice" entityId={invoice._id} />
          </div>
        </TabsContent>
      </Tabs>

      <InvoicePaymentDialog
        invoiceId={invoice._id}
        amountDue={invoice.amountDue}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction === "cancel" ? "Cancel invoice?" : "Mark deposit refunded?"}
        description={
          confirmAction === "cancel"
            ? "This will mark the invoice as cancelled. This cannot be undone."
            : "This confirms the security deposit has been returned to the customer."
        }
        confirmLabel={confirmAction === "cancel" ? "Cancel Invoice" : "Confirm Refund"}
        variant={confirmAction === "cancel" ? "destructive" : "default"}
        isLoading={cancelMutation.isPending || refundDepositMutation.isPending}
        onConfirm={() => {
          if (confirmAction === "cancel") cancelMutation.mutate();
          else if (confirmAction === "refund-deposit") refundDepositMutation.mutate();
        }}
      />
    </div>
  );
}
