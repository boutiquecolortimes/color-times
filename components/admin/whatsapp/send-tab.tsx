"use client";

import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SendTemplateForm } from "@/components/admin/whatsapp/send-template-form";
import { useMetaTemplates } from "@/components/admin/whatsapp/use-meta-templates";

export function WhatsAppSendTab() {
  const { data, isLoading, error } = useMetaTemplates();
  if (isLoading) return <Skeleton className="h-80 w-full rounded-xl" />;
  if (error)
    return (
      <p className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {(error as Error).message}
      </p>
    );
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-4 text-sm text-muted-foreground">
        Send any approved template to any customer — useful for one-off messages that aren&apos;t tied
        to a booking or bill. It&apos;s logged in Message Log and the Inbox.
      </p>
      <SendTemplateForm templates={data?.templates ?? []} />
    </div>
  );
}
