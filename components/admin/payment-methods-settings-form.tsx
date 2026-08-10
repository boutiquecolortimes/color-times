"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentMethodsSettingsInput } from "@/lib/validations/payment-methods";

export function PaymentMethodsSettingsForm({
  initialSettings,
}: {
  initialSettings: PaymentMethodsSettingsInput;
}) {
  const [options, setOptions] = useState<string[]>(initialSettings.options);
  const [draft, setDraft] = useState("");

  const mutation = useMutation({
    mutationFn: async (values: PaymentMethodsSettingsInput) => {
      const res = await fetch("/api/admin/settings/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.settings as PaymentMethodsSettingsInput;
    },
    onSuccess: (settings) => {
      toast.success("Payment methods saved");
      setOptions(settings.options);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function addOption() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (options.some((option) => option.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`"${trimmed}" is already in the list`);
      return;
    }
    setOptions((prev) => [...prev, trimmed]);
    setDraft("");
  }

  function removeOption(option: string) {
    setOptions((prev) => prev.filter((item) => item !== option));
  }

  const isDirty = JSON.stringify(options) !== JSON.stringify(initialSettings.options);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-heading text-lg">Payment Methods</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These appear in the Payment Method dropdown when creating a booking. Add as many as your
          team actually uses — Online, Cash, and Manual are just a starting point, not a fixed list.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground">No payment methods yet — add one below.</p>
          )}
          {options.map((option) => (
            <span
              key={option}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 py-1 pr-1.5 pl-3 text-sm"
            >
              {option}
              <button
                type="button"
                onClick={() => removeOption(option)}
                aria-label={`Remove ${option}`}
                className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            placeholder="e.g. UPI, Bank Transfer, Cheque..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addOption();
              }
            }}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" onClick={addOption} disabled={!draft.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={mutation.isPending || !isDirty || options.length === 0}
          onClick={() => mutation.mutate({ options })}
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
