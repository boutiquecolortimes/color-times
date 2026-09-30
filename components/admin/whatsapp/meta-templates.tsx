"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Code2, Loader2, Plus, RefreshCw, Search, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { MetaTemplatePreview } from "@/components/admin/whatsapp/template-preview";
import { SendTemplateForm } from "@/components/admin/whatsapp/send-template-form";
import { CreateTemplateDialog } from "@/components/admin/whatsapp/create-template-dialog";
import { useMetaTemplates } from "@/components/admin/whatsapp/use-meta-templates";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";
import { TRIGGER_EVENT_LABELS, type WhatsAppTriggerEvent } from "@/lib/notifications/trigger-events";
import { countPositionalParams, getComponent, type MetaTemplate } from "@/lib/whatsapp/meta-types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  IN_APPEAL: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  PAUSED: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  DISABLED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

interface SyncReport {
  created: string[];
  updated: string[];
  warnings: string[];
}

export function WhatsAppMetaTemplates() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useMetaTemplates();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [sendTemplate, setSendTemplate] = useState<MetaTemplate | null>(null);
  const [jsonTemplate, setJsonTemplate] = useState<MetaTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetaTemplate | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);

  const templates = useMemo(() => data?.templates ?? [], [data]);
  const filtered = templates.filter(
    (t) =>
      (status === "all" || t.status === status) &&
      (category === "all" || t.category === category) &&
      (!search || t.name.toLowerCase().includes(search.toLowerCase()) ||
        getComponent(t, "BODY")?.text?.toLowerCase().includes(search.toLowerCase()))
  );
  const statusCounts = templates.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const sync = useMutation({
    mutationFn: () => whatsappApi<SyncReport>("/api/admin/whatsapp/meta-templates/sync", { method: "POST" }),
    onSuccess: (report) => {
      setSyncReport(report);
      toast.success(`Synced — ${report.created.length} added, ${report.updated.length} updated`);
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (t: MetaTemplate) =>
      whatsappApi(
        `/api/admin/whatsapp/meta-templates?name=${encodeURIComponent(t.name)}&id=${encodeURIComponent(t.id)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      toast.success("Template deleted from WhatsApp");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
    },
    onError: (err: Error) => toast.error(err.message, { duration: 10000 }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-secondary px-2.5 py-1">{templates.length} total</span>
          {Object.entries(statusCounts).map(([s, n]) => (
            <span key={s} className={cn("rounded-full px-2.5 py-1", STATUS_STYLES[s] ?? "bg-secondary")}>
              {n} {s.toLowerCase().replace("_", " ")}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Sync to app triggers
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        </div>
      </div>

      {syncReport && syncReport.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Check these after syncing
          </p>
          <ul className="list-disc space-y-0.5 pl-6">
            {syncReport.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="w-64 pl-9" placeholder="Search name or text…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => (v === "all" ? "All statuses" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {["all", "APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"].map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => (v === "all" ? "All categories" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {["all", "UTILITY", "MARKETING", "AUTHENTICATION"].map((c) => (
              <SelectItem key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {(error as Error).message}
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const mapping = data?.mappings[t.name] ?? [];
            const header = getComponent(t, "HEADER");
            const vars = countPositionalParams(getComponent(t, "BODY")?.text);
            return (
              <article key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                <MetaTemplatePreview template={t} />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-all font-medium">{t.name}</p>
                    <Badge className={cn("shrink-0 rounded-full border-none font-medium", STATUS_STYLES[t.status] ?? "bg-secondary text-foreground")}>
                      {t.status}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>
                      {t.category}
                      {t.sub_category ? ` · ${t.sub_category}` : ""}
                    </dd>
                    <dt className="text-muted-foreground">Language</dt>
                    <dd>{t.language}</dd>
                    <dt className="text-muted-foreground">Header</dt>
                    <dd>{header?.format ?? "None"}</dd>
                    <dt className="text-muted-foreground">Variables</dt>
                    <dd>{vars}</dd>
                    <dt className="text-muted-foreground">Quality</dt>
                    <dd>{t.quality_score?.score ?? "—"}</dd>
                    <dt className="text-muted-foreground">Template ID</dt>
                    <dd className="break-all font-mono">{t.id}</dd>
                    <dt className="text-muted-foreground">App trigger</dt>
                    <dd>
                      {mapping.length === 0
                        ? "Not linked"
                        : mapping
                            .map(
                              (m) =>
                                `${TRIGGER_EVENT_LABELS[m.triggerEvent as WhatsAppTriggerEvent] ?? m.triggerEvent}${m.isActive ? " ✓" : " (off)"}`
                            )
                            .join(", ")}
                    </dd>
                  </dl>
                  {t.rejected_reason && t.rejected_reason !== "NONE" && (
                    <p className="text-xs text-red-700 dark:text-red-400">Rejected: {t.rejected_reason}</p>
                  )}
                  <div className="mt-auto flex justify-end gap-1 pt-2">
                    <Button variant="ghost" size="icon" title="View raw JSON" onClick={() => setJsonTemplate(t)}>
                      <Code2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Send this template"
                      disabled={t.status !== "APPROVED"}
                      onClick={() => setSendTemplate(t)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title="Delete from WhatsApp"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && !error && (
            <p className="col-span-full py-10 text-center text-muted-foreground">No templates match.</p>
          )}
        </div>
      )}

      <CreateTemplateDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={sendTemplate !== null} onOpenChange={(o) => !o && setSendTemplate(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Send {sendTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            {sendTemplate && (
              <SendTemplateForm
                templates={templates}
                initialTemplateId={sendTemplate.id}
                onSent={() => setSendTemplate(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={jsonTemplate !== null} onOpenChange={(o) => !o && setJsonTemplate(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{jsonTemplate?.name}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[70vh] overflow-auto rounded-md bg-secondary p-3 text-xs">
            {JSON.stringify(jsonTemplate, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete “${deleteTarget?.name}” from WhatsApp?`}
        description="This removes the template from your WhatsApp Business Account (this language version). Any app trigger using it is switched off. Meta doesn't let you reuse the same name for 30 days."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
      />
    </div>
  );
}
