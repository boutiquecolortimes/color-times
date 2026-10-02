"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// For a booking marked Returned by mistake: puts it back to Picked Up and
// rolls back the return (settlement, dress status, auto-created dry-clean /
// tailor orders, invoice). The reason is kept in the booking's Activity.
export function UndoReturnDialog({
  bookingId,
  bookingNumber,
  open,
  onOpenChange,
}: {
  bookingId: string;
  bookingNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/bookings/${bookingId}/undo-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Bring the invoice back to the Picked Up figures. The booking is
      // already restored either way, so a failure here is only a warning.
      const invoiceRes = await fetch("/api/admin/invoices/from-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, undoReturn: true }),
      });
      if (!invoiceRes.ok) {
        const invoiceJson = await invoiceRes.json().catch(() => ({}));
        toast.error(
          `Return undone, but the invoice couldn't be updated: ${invoiceJson.error ?? "unknown error"}`
        );
      }
      return json.data as { cancelledServiceOrders: number };
    },
    onSuccess: ({ cancelledServiceOrders }) => {
      toast.success(
        cancelledServiceOrders > 0
          ? `Return undone — booking is Picked Up again (${cancelledServiceOrders} service order(s) cancelled)`
          : "Return undone — booking is Picked Up again"
      );
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin", "booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoice"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      onOpenChange(false);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reasonOk = reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Undo return of {bookingNumber}?</DialogTitle>
          <DialogDescription>
            Use this if the booking was marked Returned by mistake. It goes back to{" "}
            <span className="font-medium text-foreground">Picked Up</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Return condition, damage charges and deposit refund are cleared.</li>
            <li>The dresses show as picked up again.</li>
            <li>Dry-clean / tailor orders created at this return (not started yet) are cancelled.</li>
            <li>The invoice goes back to the Picked Up amounts.</li>
            <li>What was undone, by whom and why is kept in the booking&rsquo;s Activity.</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            If a deposit refund was already handed back, record it again when you mark the
            booking Returned.
          </p>
          <div>
            <label className="font-medium">Reason</label>
            <Textarea
              className="mt-1.5"
              rows={2}
              placeholder="e.g. Marked returned by mistake — dress not back yet"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Keep as Returned
          </Button>
          <Button disabled={!reasonOk || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Undo Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
