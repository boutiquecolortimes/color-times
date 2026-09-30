"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";
import type {
  MetaAnalyticsPoint,
  MetaBusinessProfile,
  MetaCommerceSettings,
  MetaPhoneNumber,
  MetaSubscribedApp,
  MetaWabaInfo,
} from "@/lib/whatsapp/meta-types";
import { BusinessProfileDialog } from "@/components/admin/whatsapp/business-profile-dialog";

interface Maybe<T> {
  data: T | null;
  error: string | null;
}

export interface OverviewData {
  config: Record<"accessToken" | "phoneNumberId" | "businessAccountId" | "webhookVerifyToken" | "appSecret", boolean>;
  phone: Maybe<MetaPhoneNumber>;
  profile: Maybe<MetaBusinessProfile>;
  waba: Maybe<MetaWabaInfo>;
  phoneNumbers: Maybe<MetaPhoneNumber[]>;
  analytics: Maybe<MetaAnalyticsPoint[]>;
  subscribedApps: Maybe<MetaSubscribedApp[]>;
  commerce: Maybe<MetaCommerceSettings>;
  webhook: {
    lastVerifiedAt: string | null;
    lastEventAt: string | null;
    lastInboundAt: string | null;
    recent: { kind: "verify" | "event" | "rejected"; ok: boolean; summary: string; createdAt: string }[];
  };
  stats: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    inbound: number;
    unreadInbound: number;
  };
}

const CONFIG_LABELS: Record<keyof OverviewData["config"], { env: string; purpose: string; required: boolean }> = {
  accessToken: { env: "META_WHATSAPP_ACCESS_TOKEN", purpose: "All Meta API calls", required: true },
  phoneNumberId: { env: "META_WHATSAPP_PHONE_NUMBER_ID", purpose: "Sending, profile, QR codes", required: true },
  businessAccountId: {
    env: "META_WHATSAPP_BUSINESS_ACCOUNT_ID",
    purpose: "Templates, account info, analytics",
    required: true,
  },
  webhookVerifyToken: {
    env: "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    purpose: "Inbox + delivery/read ticks",
    required: true,
  },
  appSecret: { env: "META_APP_SECRET", purpose: "Verifies webhook signatures (recommended)", required: false },
};

const QUALITY_STYLES: Record<string, string> = {
  GREEN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  YELLOW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  RED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const TIER_LABELS: Record<string, string> = {
  TIER_50: "50 customers / 24h",
  TIER_250: "250 customers / 24h",
  TIER_1K: "1,000 customers / 24h",
  TIER_10K: "10,000 customers / 24h",
  TIER_100K: "100,000 customers / 24h",
  TIER_UNLIMITED: "Unlimited",
};

function pretty(value?: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-words text-sm">{value ?? "—"}</div>
    </div>
  );
}

function Card({
  title,
  action,
  error,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg">{title}</h2>
        {action}
      </div>
      {error ? (
        <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function timeAgo(value: string): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function WebhookStatus({ webhook, verifyTokenSet }: { webhook: OverviewData["webhook"]; verifyTokenSet: boolean }) {
  const callbackUrl =
    (typeof window !== "undefined" ? window.location.origin : "") + "/api/webhooks/meta-whatsapp";
  const latest = webhook.recent[0];

  let tone: "ok" | "warn" | "bad";
  let headline: string;
  let detail: React.ReactNode;

  if (latest && !latest.ok) {
    tone = "bad";
    headline = latest.kind === "verify" ? "Meta's verification failed" : "Meta is calling, but the call was rejected";
    detail = latest.summary;
  } else if (webhook.lastEventAt) {
    tone = webhook.lastInboundAt ? "ok" : "warn";
    headline = `Connected — last call from Meta ${timeAgo(webhook.lastEventAt)}`;
    detail = webhook.lastInboundAt
      ? `Last customer message received ${timeAgo(webhook.lastInboundAt)}.`
      : "Delivery updates are arriving, but no customer message has come in yet. If a customer has written to you, subscribe the “messages” field in your Meta app’s webhook settings.";
  } else if (webhook.lastVerifiedAt) {
    tone = "warn";
    headline = `Callback URL verified ${timeAgo(webhook.lastVerifiedAt)}, but no messages received yet`;
    detail =
      "Meta accepted the URL. Now subscribe the “messages” field, subscribe this app to your WhatsApp account (below), and make sure the Meta app is Live, not in Development.";
  } else {
    tone = "bad";
    headline = "Meta hasn't called this webhook yet";
    detail = verifyTokenSet
      ? "Paste the callback URL below into your Meta app (WhatsApp → Configuration → Webhook → Edit) with your verify token, then click Verify and save."
      : "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN isn't set in Vercel yet — add it, redeploy, then paste the callback URL below into your Meta app.";
  }

  const toneClass = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    bad: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  }[tone];
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : XCircle;

  return (
    <div className="space-y-4">
      <div className={cn("flex gap-3 rounded-lg border p-3", toneClass)}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">{headline}</p>
          <p className="mt-0.5 text-sm opacity-90">{detail}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Callback URL"
          value={<span className="break-all font-mono text-xs">{callbackUrl}</span>}
        />
        <Field label="Verify token on server" value={verifyTokenSet ? "Set" : "Missing"} />
        <Field
          label="Fields to subscribe in Meta"
          value={<span className="font-mono text-xs">messages, message_template_status_update</span>}
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          Recent calls from Meta (last 7 days)
        </p>
        {webhook.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {webhook.recent.map((e, i) => (
              <li key={i} className="flex items-start gap-2 px-3 py-2">
                {e.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <span className="flex-1">{e.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function rate(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

export function WhatsAppOverview() {
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "whatsapp", "overview"],
    queryFn: () => whatsappApi<OverviewData>("/api/admin/whatsapp/overview"),
  });

  const subscribe = useMutation({
    mutationFn: () => whatsappApi("/api/admin/whatsapp/subscribe", { method: "POST" }),
    onSuccess: () => {
      toast.success("App subscribed to WhatsApp webhooks");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (error && !data) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <p className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Couldn&apos;t load the overview:{" "}
          {(error as Error).message}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const { phone, profile, waba, phoneNumbers, analytics, subscribedApps, commerce, stats, config, webhook } = data;
  const chartData = (analytics.data ?? []).map((point) => ({
    label: new Date(point.start * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    sent: point.sent,
    delivered: point.delivered,
  }));
  const metaTotals = (analytics.data ?? []).reduce(
    (acc, p) => ({ sent: acc.sent + p.sent, delivered: acc.delivered + p.delivered }),
    { sent: 0, delivered: 0 }
  );
  const health = waba.data?.health_status?.can_send_message;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh from Meta
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Phone number" error={phone.error}>
          {phone.data && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading text-xl">{phone.data.display_phone_number}</p>
                {phone.data.quality_rating && (
                  <Badge
                    className={cn(
                      "rounded-full border-none font-medium",
                      QUALITY_STYLES[phone.data.quality_rating] ?? "bg-secondary text-foreground"
                    )}
                  >
                    Quality: {pretty(phone.data.quality_rating)}
                  </Badge>
                )}
                {phone.data.is_official_business_account && (
                  <Badge className="rounded-full border-none bg-sky-100 font-medium text-sky-800">
                    Official business
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Display name" value={phone.data.verified_name} />
                <Field label="Name status" value={pretty(phone.data.name_status)} />
                <Field
                  label="Messaging limit"
                  value={TIER_LABELS[phone.data.messaging_limit_tier ?? ""] ?? pretty(phone.data.messaging_limit_tier)}
                />
                <Field label="Status" value={pretty(phone.data.status)} />
                <Field label="Verification" value={pretty(phone.data.code_verification_status)} />
                <Field label="Mode" value={pretty(phone.data.account_mode)} />
                <Field label="Platform" value={pretty(phone.data.platform_type)} />
                <Field label="Throughput" value={pretty(phone.data.throughput?.level)} />
              </div>
              <p className="text-xs text-muted-foreground">Phone number ID {phone.data.id}</p>
            </div>
          )}
        </Card>

        <Card title="WhatsApp Business Account" error={waba.error}>
          {waba.data && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading text-xl">{waba.data.name ?? "—"}</p>
                {health && (
                  <Badge
                    className={cn(
                      "rounded-full border-none font-medium",
                      health === "AVAILABLE"
                        ? QUALITY_STYLES.GREEN
                        : health === "LIMITED"
                          ? QUALITY_STYLES.YELLOW
                          : QUALITY_STYLES.RED
                    )}
                  >
                    Can send: {pretty(health)}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account ID" value={waba.data.id} />
                <Field label="Business" value={waba.data.owner_business_info?.name} />
                <Field label="Business verification" value={pretty(waba.data.business_verification_status)} />
                <Field label="Account review" value={pretty(waba.data.account_review_status)} />
                <Field label="Currency" value={waba.data.currency} />
                <Field label="Timezone ID" value={waba.data.timezone_id} />
                <Field label="Country" value={waba.data.country} />
                <Field label="Ownership" value={pretty(waba.data.ownership_type)} />
              </div>
              <Field
                label="Template namespace"
                value={<span className="font-mono text-xs">{waba.data.message_template_namespace}</span>}
              />
              {waba.data.health_status?.entities
                ?.flatMap((e) => e.errors ?? [])
                .map((e, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                    {e.error_description}
                  </p>
                ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Webhook status">
        <WebhookStatus webhook={webhook} verifyTokenSet={config.webhookVerifyToken} />
      </Card>

      <Card
        title="Business profile"
        error={profile.error}
        action={
          profile.data && (
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )
        }
      >
        {profile.data && (
          <div className="flex flex-col gap-5 sm:flex-row">
            {profile.data.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Meta CDN URL, short-lived
              <img
                src={profile.data.profile_picture_url}
                alt="WhatsApp profile"
                className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="h-20 w-20 shrink-0 rounded-full bg-secondary" />
            )}
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <Field label="About" value={profile.data.about} />
              <Field label="Category" value={pretty(profile.data.vertical)} />
              <Field label="Description" value={profile.data.description} />
              <div className="space-y-1.5 text-sm">
                {profile.data.address && (
                  <p className="flex gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    {profile.data.address}
                  </p>
                )}
                {profile.data.email && (
                  <p className="flex gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    {profile.data.email}
                  </p>
                )}
                {profile.data.websites?.map((site) => (
                  <p key={site} className="flex gap-2">
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <a href={site} target="_blank" rel="noreferrer" className="break-all underline">
                      {site}
                    </a>
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Messages — last 30 days">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Sent by app" value={stats.sent} />
          <Stat label="Delivered" value={stats.delivered} hint={rate(stats.delivered, stats.sent)} />
          <Stat label="Read" value={stats.read} hint={rate(stats.read, stats.sent)} />
          <Stat label="Failed" value={stats.failed} hint={rate(stats.failed, stats.total)} />
          <Stat label="Received" value={stats.inbound} />
          <Stat label="Unread in inbox" value={stats.unreadInbound} />
        </div>
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Meta analytics (all messages on this account)</p>
            {analytics.data && (
              <p className="text-xs text-muted-foreground">
                {metaTotals.sent} sent · {metaTotals.delivered} delivered
              </p>
            )}
          </div>
          {analytics.error ? (
            <p className="text-sm text-muted-foreground">Analytics unavailable: {analytics.error}</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages in this period.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="sent" name="Sent" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#25D366" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      <Card title="All phone numbers on this account" error={phoneNumbers.error}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Number</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Quality</th>
                <th className="py-2 pr-4">Limit</th>
                <th className="py-2">ID</th>
              </tr>
            </thead>
            <tbody>
              {(phoneNumbers.data ?? []).map((n) => (
                <tr key={n.id} className="border-t border-border">
                  <td className="py-2 pr-4 font-medium">
                    {n.display_phone_number}
                    {n.id === phone.data?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(sending)</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{n.verified_name}</td>
                  <td className="py-2 pr-4">{pretty(n.quality_rating)}</td>
                  <td className="py-2 pr-4">{TIER_LABELS[n.messaging_limit_tier ?? ""] ?? pretty(n.messaging_limit_tier)}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">{n.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Setup checklist">
          <ul className="space-y-2.5">
            {(Object.keys(CONFIG_LABELS) as (keyof OverviewData["config"])[]).map((key) => {
              const item = CONFIG_LABELS[key];
              const ok = config[key];
              return (
                <li key={key} className="flex items-start gap-2.5 text-sm">
                  {ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : item.required ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <div>
                    <p className="font-mono text-xs">{item.env}</p>
                    <p className="text-xs text-muted-foreground">{item.purpose}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="App subscription & commerce">
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Subscribed apps</p>
              {subscribedApps.error ? (
                <p className="mt-1 text-sm text-muted-foreground">{subscribedApps.error}</p>
              ) : (subscribedApps.data ?? []).length === 0 ? (
                <div className="mt-1 space-y-2">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No app is subscribed — incoming messages and read receipts won&apos;t reach the app.
                  </p>
                  <Button size="sm" onClick={() => subscribe.mutate()} disabled={subscribe.isPending}>
                    {subscribe.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Subscribe this app
                  </Button>
                </div>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {subscribedApps.data!.map((app, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {app.whatsapp_business_api_data?.name ?? "App"}{" "}
                      <span className="text-xs text-muted-foreground">
                        {app.whatsapp_business_api_data?.id}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Catalog visible"
                value={commerce.error ? "—" : commerce.data?.is_catalog_visible ? "Yes" : "No"}
              />
              <Field
                label="Cart enabled"
                value={commerce.error ? "—" : commerce.data?.is_cart_enabled ? "Yes" : "No"}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Webhook URL: <span className="font-mono">/api/webhooks/meta-whatsapp</span> — subscribe to
              the <span className="font-mono">messages</span> and{" "}
              <span className="font-mono">message_template_status_update</span> fields in your Meta app.
            </p>
          </div>
        </Card>
      </div>

      {profile.data && (
        <BusinessProfileDialog open={profileOpen} onOpenChange={setProfileOpen} profile={profile.data} />
      )}
    </div>
  );
}
