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

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

interface BookingSummary {
  totalAmount: number;
  advancePaid: number;
  securityDeposit: number;
}

export function ConfirmBookingDialog({
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

  // The rent and advance entered when the booking was first noted down
  // (often a phone inquiry) may not match what's actually being charged and
  // collected now — let staff correct both right here before the invoice is
  // generated. Lazy initializers (not an effect) so opening the dialog
  // never silently changes what's about to be sent. Security deposit is no
  // longer set here — it's collected at Pickup instead — so it's carried
  // through read-only from whatever's already on the booking (0 for a
  // brand-new one).
  const [rentAmount, setRentAmount] = useState(() => summary.totalAmount - summary.securityDeposit);
  const [advancePaid, setAdvancePaid] = useState(() => summary.advancePaid);

  const totalAmount = rentAmount + summary.securityDeposit;
  const dueAmount = Math.max(0, totalAmount - advancePaid);

  function resetToSummary() {
    setRentAmount(summary.totalAmount - summary.securityDeposit);
    setAdvancePaid(summary.advancePaid);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const statusRes = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "confirmed",
          rentAmount,
          advancePaid,
        }),
      });
      const statusJson = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusJson.error);

      const invoiceRes = await fetch("/api/admin/invoices/from-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const invoiceJson = await invoiceRes.json();
      if (!invoiceRes.ok) throw new Error(invoiceJson.error);
      // 201 = a brand-new invoice; 200 = an existing one (e.g. from an
      // earlier confirm attempt) was just resynced to the booking's
      // current numbers instead of failing.
      return {
        invoice: invoiceJson.data.invoice as { _id: string },
        created: invoiceRes.status === 201,
      };
    },
    onSuccess: ({ invoice, created }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
      onOpenChange(false);
      toast.success(created ? "Booking confirmed and invoice generated" : "Booking confirmed and invoice updated");
      router.push(`/admin/invoices/${invoice._id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (!next) resetToSummary();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm booking</DialogTitle>
          <DialogDescription>
            This reserves the dress and generates the invoice automatically — correct any of the
            amounts below first if they've changed since the booking was first noted down.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Rent amount (&#8377;)</label>
            <Input
              className="mt-2"
              type="number"
              min={0}
              value={rentAmount === 0 ? "" : rentAmount}
              onChange={(event) => setRentAmount(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>

          {summary.securityDeposit > 0 && (
            <p className="text-xs text-muted-foreground">
              Security deposit of {formatCurrency(summary.securityDeposit)} already on file carries
              over as-is — correct it at Pickup instead of here.
            </p>
          )}

          <div>
            <label className="text-sm font-medium">Advance paid (&#8377;)</label>
            <Input
              className="mt-2"
              type="number"
              min={0}
              value={advancePaid === 0 ? "" : advancePaid}
              onChange={(event) => setAdvancePaid(Math.max(0, Number(event.target.value) || 0))}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total amount</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advance paid</span>
              <span>{formatCurrency(advancePaid)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
              <span>Due amount</span>
              <span className="text-accent">{formatCurrency(dueAmount)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetToSummary();
              onOpenChange(false);
            }}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm &amp; Generate Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
