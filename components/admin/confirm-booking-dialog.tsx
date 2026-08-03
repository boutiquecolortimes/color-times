"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const dueAmount = Math.max(0, summary.totalAmount - summary.advancePaid);

  const mutation = useMutation({
    mutationFn: async () => {
      const statusRes = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      const statusJson = await statusRes.json();
      if (!statusRes.ok) throw new Error(statusJson.error);

      const invoiceRes = await fetch("/api/admin/invoices/from-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const invoiceJson = await invoiceRes.json();
      if (!invoiceRes.ok) {
        // Booking is already confirmed at this point — an already-existing invoice shouldn't block that.
        if (invoiceRes.status === 409) return { invoice: null };
        throw new Error(invoiceJson.error);
      }
      return { invoice: invoiceJson.data.invoice as { _id: string } };
    },
    onSuccess: ({ invoice }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
      onOpenChange(false);
      if (invoice) {
        toast.success("Booking confirmed and invoice generated");
        router.push(`/admin/invoices/${invoice._id}`);
      } else {
        toast.success("Booking confirmed");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm booking</DialogTitle>
          <DialogDescription>
            This reserves the dress and generates the invoice automatically — no separate step needed.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total amount</span>
            <span>{formatCurrency(summary.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Advance paid</span>
            <span>{formatCurrency(summary.advancePaid)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
            <span>Due amount</span>
            <span className="text-accent">{formatCurrency(dueAmount)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
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
