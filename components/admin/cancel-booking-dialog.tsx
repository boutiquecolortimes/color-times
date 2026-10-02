"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

// Shown before any booking is moved to "Cancelled". Per the boutique's
// terms (printed on every invoice): once a dress is booked it can't be
// cancelled, and if it is, the advance paid is not refunded. Staff must
// tick the acknowledgement before the cancel goes through, so the
// no-refund policy is applied deliberately rather than by a stray click
// in the status dropdown.
export function CancelBookingDialog({
  open,
  onOpenChange,
  bookingNumber,
  customerName,
  advancePaid,
  isLoading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingNumber: string;
  customerName?: string;
  advancePaid: number;
  isLoading?: boolean;
  onConfirm: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  function handleOpenChange(next: boolean) {
    if (isLoading) return;
    if (!next) setAcknowledged(false);
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel booking {bookingNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            {customerName ? `${customerName}'s booking` : "This booking"} will be cancelled and
            the dress released for other bookings. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            {advancePaid > 0 ? (
              <p className="font-medium">
                Advance of {formatCurrency(advancePaid)} will NOT be refunded.
              </p>
            ) : (
              <p className="font-medium">No advance has been recorded on this booking.</p>
            )}
            <p>
              As per booking terms, a booked dress cannot be cancelled — if cancelled, the
              advance deposit is not returned.
            </p>
            <p lang="hi">
              ड्रेस बुक हो जाने के बाद उसे कैंसिल नहीं किया जाएगा यदि कैंसिल किया जाता है तो
              एडवांस जमा रुपये वापस नहीं होगें।
            </p>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-red-600"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            disabled={isLoading}
          />
          <span>
            I confirm the customer has been told the advance
            {advancePaid > 0 ? ` of ${formatCurrency(advancePaid)}` : ""} will not be refunded.
          </span>
        </label>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              setAcknowledged(false);
            }}
            disabled={isLoading || !acknowledged}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Cancel Booking — No Refund
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
