"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle2, Power, Zap, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  whatsAppSettingsSchema,
  type WhatsAppSettingsInput,
} from "@/lib/validations/whatsapp-settings";

export function WhatsAppSettingsForm({
  initialSettings,
  isMetaConfigured,
  isWebhookVerifyTokenConfigured,
}: {
  initialSettings: WhatsAppSettingsInput;
  isMetaConfigured: boolean;
  isWebhookVerifyTokenConfigured: boolean;
}) {
  const form = useForm<WhatsAppSettingsInput>({
    resolver: zodResolver(whatsAppSettingsSchema),
    defaultValues: initialSettings,
  });

  // Meta Cloud API is the only provider wired up in this UI — Brevo support
  // stays in the codebase (lib/notifications/brevo-whatsapp.ts) but isn't
  // exposed here, so "configured" only ever means Meta's credentials.
  const isConfigured = isMetaConfigured;

  const mutation = useMutation({
    mutationFn: async (values: WhatsAppSettingsInput) => {
      const res = await fetch("/api/admin/whatsapp/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data.settings as WhatsAppSettingsInput;
    },
    onSuccess: (settings) => {
      toast.success("WhatsApp settings saved");
      form.reset(settings);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div
        className={
          isConfigured
            ? "flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
            : "flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
        }
      >
        {isConfigured ? (
          <CheckCircle2 className="h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0" />
        )}
        <div className="text-sm">
          {isConfigured ? (
            <p>Meta Cloud API credentials are configured. WhatsApp messages can be sent.</p>
          ) : (
            <p>
              <span className="font-medium">META_WHATSAPP_ACCESS_TOKEN</span> and{" "}
              <span className="font-medium">META_WHATSAPP_PHONE_NUMBER_ID</span> are not set. Add
              them as environment variables (e.g. in Vercel) once you&apos;ve completed
              Meta&apos;s business verification — everything else here will still save normally.
            </p>
          )}
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-6"
        >
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Radio className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-heading text-lg">Integration</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Which API sends the actual WhatsApp messages.
                </p>
              </div>
            </div>

            <div className="mt-4 sm:pl-12">
              <div>
                <p className="text-sm font-medium">Provider</p>
                <p className="mt-2 flex h-9 w-full items-center rounded-md border border-border bg-secondary/40 px-3 text-sm sm:w-72">
                  Meta Cloud API (direct)
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Webhook callback URL</p>
                  <p className="mt-1 break-all font-mono">
                    {typeof window !== "undefined" ? window.location.origin : ""}
                    /api/webhooks/meta-whatsapp
                  </p>

                  {isWebhookVerifyTokenConfigured ? (
                    <p className="mt-2 flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        A verify token is set on the server. In Meta&apos;s webhook setup, paste
                        the callback URL above, and for{" "}
                        <span className="font-medium">Verify token</span> type the exact secret
                        value you saved as <span className="font-medium">
                          META_WHATSAPP_WEBHOOK_VERIFY_TOKEN
                        </span>{" "}
                        &mdash; that variable name is only a label for where the value lives, it is
                        never what you type into Meta.
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-medium">META_WHATSAPP_WEBHOOK_VERIFY_TOKEN</span>{" "}
                        is not set on the server yet, so Meta&apos;s verification will always fail
                        with &ldquo;callback URL or verify token couldn&apos;t be
                        validated&rdquo;. Pick any secret string (e.g. a random password), add it
                        as an environment variable named{" "}
                        <span className="font-medium">META_WHATSAPP_WEBHOOK_VERIFY_TOKEN</span> in
                        your hosting dashboard (e.g. Vercel &rarr; Project &rarr; Settings &rarr;
                        Environment Variables), redeploy, then come back here and type that same
                        secret value &mdash; not the variable name &mdash; into Meta&apos;s{" "}
                        <span className="font-medium">Verify token</span> field.
                      </span>
                    </p>
                  )}
                </div>
              </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Power className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="font-heading text-lg">Enable WhatsApp Notifications</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Master switch for all automatic WhatsApp sending.
                  </p>
                </div>
              </div>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            <div className="mt-6">
              <FormField
                control={form.control}
                name="senderLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Sender Number</FormLabel>
                    <FormControl>
                      <Input placeholder="919876543210" {...field} />
                    </FormControl>
                    <FormDescription>
                      The display number for your Meta WhatsApp Business Account — the actual
                      sending number comes from META_WHATSAPP_PHONE_NUMBER_ID.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Zap className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-heading text-lg">Automatic Sending</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose which events automatically trigger a WhatsApp message (using the active
                  template for that event).
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 sm:pl-12">
              {(
                [
                  ["autoSendOnBookingConfirmed", "Booking Confirmed"],
                  ["autoSendOnBookingReturned", "Booking Returned"],
                  ["autoSendOnBookingCancelled", "Booking Cancelled"],
                  ["autoSendOnInvoiceSent", "Invoice Sent"],
                  ["autoSendOnPaymentReceived", "Payment Received"],
                  ["autoSendOnCustomisationBillSent", "Customisation Bill Sent"],
                  ["autoSendOnSaleBillSent", "Sale Bill Sent"],
                ] as const
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <FormLabel className="font-normal">{label}</FormLabel>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              ))}
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
    </div>
  );
}
