"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  inventorySettingsSchema,
  type InventorySettingsInput,
} from "@/lib/validations/inventory-settings";

export function InventorySettingsForm({
  initialSettings,
}: {
  initialSettings: InventorySettingsInput;
}) {
  const form = useForm<InventorySettingsInput>({
    resolver: zodResolver(inventorySettingsSchema),
    defaultValues: initialSettings,
  });

  const mutation = useMutation({
    mutationFn: async (values: InventorySettingsInput) => {
      const res = await fetch("/api/admin/settings/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.settings as InventorySettingsInput;
    },
    onSuccess: (settings) => {
      toast.success("Inventory settings saved");
      form.reset(settings);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-8"
      >
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg">Stock &amp; Code</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Low Stock Threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Products at or below this stock count will be flagged as low stock.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="skuPrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code Prefix</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>Used when auto-generating new codes.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg">Pricing Defaults</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="defaultSecurityDepositMultiplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Security Deposit Multiplier</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.5"
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Quick Add uses this &times; rental price/day as the default deposit.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultRetailValueMultiplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Retail Value Multiplier</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.5"
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Quick Add uses this &times; rental price/day as the default retail value.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg">Automation</h2>
          <div className="mt-4">
            <FormField
              control={form.control}
              name="autoArchiveOutOfStock"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Automatically archive products when all sizes reach zero stock
                  </label>
                </FormItem>
              )}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}
