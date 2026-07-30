"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReturnCondition } from "@/models/Booking";
import { cn } from "@/lib/utils";

const CONDITION_OPTIONS: { value: ReturnCondition; label: string }[] = [
  { value: "good", label: "Good — no issues" },
  { value: "minor_damage", label: "Minor damage" },
  { value: "major_damage", label: "Major damage" },
  { value: "missing_items", label: "Missing items" },
];

interface BookingFinancials {
  totalAmount: number;
  securityDeposit: number;
  advancePaid: number;
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function ReturnBookingDialog({
  bookingId,
  open,
  onOpenChange,
  onSuccess,
}: {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const [condition, setCondition] = useState<ReturnCondition>("good");
  const [notes, setNotes] = useState("");
  const [dryCleaningRequired, setDryCleaningRequired] = useState(false);
  const [stitchingRequired, setStitchingRequired] = useState(false);
  const [damageCharges, setDamageCharges] = useState(0);
  const [pendingRentOverride, setPendingRentOverride] = useState<number | null>(null);
  const [depositRefunded, setDepositRefunded] = useState(true);

  const { data: financials, isLoading: isLoadingFinancials } = useQuery<BookingFinancials | null>({
    queryKey: ["admin", "booking", bookingId, "financials"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/bookings/${bookingId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const booking = json.data.booking;
      return {
        totalAmount: booking.totalAmount,
        securityDeposit: booking.securityDeposit,
        advancePaid: booking.advancePaid ?? 0,
      };
    },
    enabled: open && Boolean(bookingId),
  });

  const securityDeposit = financials?.securityDeposit ?? 0;
  const pendingRentDefault = financials
    ? Math.max(0, financials.totalAmount - financials.securityDeposit - financials.advancePaid)
    : 0;
  const pendingRentAmount = pendingRentOverride ?? pendingRentDefault;
  const amountOwed = damageCharges + pendingRentAmount;
  const netPosition = amountOwed - securityDeposit;
  const depositRefundAmount = netPosition < 0 ? -netPosition : 0;
  const finalSettlementAmount = netPosition;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "returned",
          returnCondition: condition,
          returnNotes: notes,
          dryCleaningRequired,
          stitchingRequired,
          damageCharges,
          pendingRentAmount,
          depositRefunded,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.booking;
    },
    onSuccess: () => {
      toast.success("Booking marked as returned");
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-orders"] });
      setCondition("good");
      setNotes("");
      setDryCleaningRequired(false);
      setStitchingRequired(false);
      setDamageCharges(0);
      setPendingRentOverride(null);
      setDepositRefunded(true);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as returned</DialogTitle>
          <DialogDescription>
            Record the condition, any charges, and settle the security deposit before closing out
            this booking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Condition</label>
            <Select value={condition} onValueChange={(value) => setCondition(value as ReturnCondition)}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue>
                  {(value: string) =>
                    CONDITION_OPTIONS.find((option) => option.value === value)?.label ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={dryCleaningRequired}
                onCheckedChange={(checked) => setDryCleaningRequired(checked === true)}
              />
              Dry cleaning required — sends the dress to Services automatically
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={stitchingRequired}
                onCheckedChange={(checked) => setStitchingRequired(checked === true)}
              />
              Stitching / repair required — sends the dress to Services automatically
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Damage charges (&#8377;)</label>
              <Input
                className="mt-2"
                type="number"
                min={0}
                value={damageCharges === 0 ? "" : damageCharges}
                onChange={(event) => setDamageCharges(Math.max(0, Number(event.target.value) || 0))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Pending rent (&#8377;)</label>
              <Input
                className="mt-2"
                type="number"
                min={0}
                value={pendingRentAmount}
                onChange={(event) => setPendingRentOverride(Math.max(0, Number(event.target.value)))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={depositRefunded}
              onCheckedChange={(checked) => setDepositRefunded(checked === true)}
            />
            Refund the remaining security deposit now
          </label>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            {isLoadingFinancials ? (
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security deposit held</span>
                  <span>{formatCurrency(securityDeposit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Damage + pending rent</span>
                  <span>{formatCurrency(amountOwed)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
                  <span>
                    {finalSettlementAmount > 0 ? "Customer still owes" : "Refund to customer"}
                  </span>
                  <span
                    className={cn(
                      finalSettlementAmount > 0 ? "text-destructive" : "text-emerald-600"
                    )}
                  >
                    {formatCurrency(
                      finalSettlementAmount > 0 ? finalSettlementAmount : depositRefundAmount
                    )}
                  </span>
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              className="mt-2"
              rows={3}
              placeholder="Describe any damage or missing items..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || isLoadingFinancials}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
