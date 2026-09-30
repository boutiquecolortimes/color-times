"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";
import type { MetaQrCode } from "@/lib/whatsapp/meta-types";

/** Pre-filled "chat with us" links and QR codes (for the shop counter, Instagram bio, bills). */
export function WhatsAppQrCodes() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("Hi Color Times Boutique! I'd like to know more about ");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "whatsapp", "qr-codes"],
    queryFn: () => whatsappApi<{ qrCodes: MetaQrCode[] }>("/api/admin/whatsapp/qr-codes").then((d) => d.qrCodes),
  });

  const create = useMutation({
    mutationFn: () => whatsappApi("/api/admin/whatsapp/qr-codes", { method: "POST", body: { prefilledMessage: message } }),
    onSuccess: () => {
      toast.success("QR code created");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "qr-codes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const remove = useMutation({
    mutationFn: (code: string) =>
      whatsappApi(`/api/admin/whatsapp/qr-codes?code=${encodeURIComponent(code)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "qr-codes"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <label className="text-sm font-medium">Message the customer starts with</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} />
          <Button onClick={() => create.mutate()} disabled={!message.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create QR
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Customers scan the code or tap the link and WhatsApp opens with this message typed in.
        </p>
      </div>

      {error && (
        <p className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {(error as Error).message}
        </p>
      )}
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((qr) => (
            <div key={qr.code} className="flex gap-4 rounded-xl border border-border bg-card p-4">
              {qr.qr_image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- Meta-hosted QR image
                <img src={qr.qr_image_url} alt="WhatsApp QR code" className="h-24 w-24 shrink-0 rounded bg-white" />
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm">{qr.prefilled_message}</p>
                <a href={qr.deep_link_url} target="_blank" rel="noreferrer" className="block truncate text-xs underline">
                  {qr.deep_link_url}
                </a>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Copy link"
                    onClick={() => {
                      void navigator.clipboard.writeText(qr.deep_link_url);
                      toast.success("Link copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    title="Delete"
                    onClick={() => remove.mutate(qr.code)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {data?.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No QR codes yet.</p>}
        </div>
      )}
    </div>
  );
}
