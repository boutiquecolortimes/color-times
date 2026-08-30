"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface BookingSummary {
  totalAmount: number;
  advancePaid: number;
  securityDeposit: number;
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function PickupBookingDialog({
  bookingId,
  summary,
  open,
  onOpenChange,
}: {
  bookingId: string;
  summary: BookingSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Security deposit can be corrected right here at handover (e.g. more was
  // actually collected than what's recorded on the booking) — same
  // principle as the correction allowed at Return. The rental-fee portion
  // of the total never changes; only the deposit, and in turn the total.
  const [securityDepositOverride, setSecurityDepositOverride] = useState<number | null>(null);
  const securityDeposit = securityDepositOverride ?? summary.securityDeposit;
  const rentalFeesTotal = summary.totalAmount - summary.securityDeposit;
  const totalAmount = rentalFeesTotal + securityDeposit;

  // Pickup now collects the full outstanding due — not just a security
  // top-up — computed directly from props (a lazy useState initializer, not
  // an effect) so opening the dialog never silently changes what's about to
  // be submitted.
  const dueAmount = Math.max(0, totalAmount - summary.advancePaid);
  const [paymentAmount, setPaymentAmount] = useState(() => dueAmount);

  const mutation = useMutation({
    mutationFn: async () => {
      const statusRes = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "in_use",
          pickupPaymentAmount: paymentAmount,
          securityDeposit,
        }),
      });
      const statusJson = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusJson.error);

      // Same as Confirm — generate the invoice right along with the status
      // change so pickup always leaves behind a bill, not just a payment.
      const invoiceRes = await fetch("/api/admin/invoices/from-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const invoiceJson = await invoiceRes.json();
      if (!invoiceRes.ok) throw new Error(invoiceJson.error);
      // 201 = a brand-new invoice; 200 = an existing one (e.g. generated
      // earlier at Confirm, when nothing had been paid yet) was just
      // resynced to include the payment just collected here.
      return {
        invoice: invoiceJson.data.invoice as { _id: string },
        created: invoiceRes.status === 201,
      };
    },
    onSuccess: ({ invoice, created }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
      setPaymentAmount(dueAmount);
      setSecurityDepositOverride(null);
      onOpenChange(false);
      toast.success(created ? "Booking picked up and invoice generated" : "Booking picked up and invoice updated");
      router.push(`/admin/invoices/${invoice._id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const advanceAfter = summary.advancePaid + paymentAmount;
  const remainingAfter = Math.max(0, totalAmount - advanceAfter);

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as picked up</DialogTitle>
          <DialogDescription>
            Collect the full outstanding payment when handing over the dress — this also
            generates the invoice automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Amount to be collected (&#8377;)</label>
              {paymentAmount !== dueAmount && (
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => setPaymentAmount(dueAmount)}
                >
                  Use full due {formatCurrency(dueAmount)}
                </button>
              )}
            </div>
            <Input
              className="mt-2"
              type="number"
              min={0}
              value={paymentAmount === 0 ? "" : paymentAmount}
              onChange={(event) => setPaymentAmount(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Security deposit (&#8377;)</label>
            <Input
              className="mt-2"
              type="number"
              min={0}
              value={securityDeposit === 0 ? "" : securityDeposit}
              onChange={(event) =>
                setSecurityDepositOverride(Math.max(0, Number(event.target.value) || 0))
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Defaults to the deposit recorded on the booking &mdash; correct it here if a
              different amount is actually being collected or topped up at handover.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total amount</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Security deposit</span>
              <span>{formatCurrency(securityDeposit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid so far</span>
              <span>{formatCurrency(summary.advancePaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid after pickup</span>
              <span>{formatCurrency(advanceAfter)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
              <span>Remaining due</span>
              <span className="text-accent">{formatCurrency(remainingAfter)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setPaymentAmount(dueAmount);
              setSecurityDepositOverride(null);
              onOpenChange(false);
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Pickup &amp; Generate Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
