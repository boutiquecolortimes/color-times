"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PaymentMethod = "cash" | "card" | "upi" | "bank_transfer" | "other";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export interface CollectPaymentTarget {
  kind: "sale" | "customisation";
  id: string;
  billNumber: string;
  customerName: string;
  totalAmount: number;
  advancePayment: number;
  dueAmount: number;
}

// Collect the remaining payment on a sale or customisation order — same
// layout as Mark as Picked Up for bookings. The payment is logged on the
// order's invoice in the Invoices menu (Advance → Due Paid history).
// For customisation, `markDelivered` also moves the order to Delivered.
export function CollectPaymentDialog({
  target,
  open,
  onOpenChange,
  markDelivered = false,
}: {
  target: CollectPaymentTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markDelivered?: boolean;
}) {
  if (!target) return null;
  // Remounting the form each time it opens resets the fields to the
  // current due amount without syncing state in an effect.
  return (
    <CollectPaymentForm
      key={`${target.kind}-${target.id}-${open ? "open" : "closed"}`}
      target={target}
      open={open}
      onOpenChange={onOpenChange}
      markDelivered={markDelivered}
    />
  );
}

function CollectPaymentForm({
  target,
  open,
  onOpenChange,
  markDelivered,
}: {
  target: CollectPaymentTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  markDelivered: boolean;
}) {
  const queryClient = useQueryClient();
  const due = Math.max(0, target.dueAmount);
  const [amount, setAmount] = useState(due);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const url =
        target.kind === "sale"
          ? `/api/admin/sales/${target.id}/payments`
          : `/api/admin/customisation-orders/${target.id}/payments`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method,
          reference: reference || undefined,
          markDelivered: markDelivered || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data as { invoiceId: string; dueAmount: number };
    },
    onSuccess: () => {
      toast.success(
        markDelivered
          ? amount > 0
            ? "Payment collected and order marked delivered"
            : "Order marked delivered"
          : "Payment collected — added to the invoice"
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "sales"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "sale"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "customisation-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "invoice"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duePaidBefore = Math.max(0, target.totalAmount - target.advancePayment - due);
  const remainingAfter = Math.max(0, due - amount);
  const tooMuch = amount > due;

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{markDelivered ? "Mark as delivered" : "Collect payment"}</DialogTitle>
          <DialogDescription>
            Bill {target.billNumber} · {target.customerName}.{" "}
            {markDelivered
              ? "Collect the remaining amount when handing over the order."
              : "Record the amount received — it's added to this bill's invoice."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Amount received (&#8377;)</label>
              {amount !== due && (
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => setAmount(due)}
                >
                  Use full due {formatCurrency(due)}
                </button>
              )}
            </div>
            <Input
              className="mt-2"
              type="number"
              min={0}
              value={amount === 0 ? "" : amount}
              onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))}
            />
            {tooMuch && (
              <p className="mt-1 text-xs text-destructive">
                More than the amount due ({formatCurrency(due)}).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Method</label>
              <Select value={method} onValueChange={(value) => setMethod((value ?? "cash") as PaymentMethod)}>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue>{(value: PaymentMethod) => METHOD_LABELS[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {METHOD_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Reference (optional)</label>
              <Input
                className="mt-2"
                placeholder="UTR / note"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advance Paid</span>
              <span>{formatCurrency(target.advancePayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Paid</span>
              <span>{formatCurrency(duePaidBefore + amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span>{formatCurrency(target.totalAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-medium">
              <span>Remaining Due</span>
              <span className="text-accent">{formatCurrency(remainingAfter)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || tooMuch || (amount <= 0 && !markDelivered)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {markDelivered ? "Confirm Delivery" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
