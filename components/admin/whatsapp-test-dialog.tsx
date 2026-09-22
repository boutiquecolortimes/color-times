"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import type { WhatsAppTemplateRow } from "@/components/admin/whatsapp-template-form-dialog";
import { TRIGGER_EVENT_VARIABLES } from "@/lib/notifications/trigger-events";

async function fetchTemplates(): Promise<WhatsAppTemplateRow[]> {
  const res = await fetch("/api/admin/whatsapp/templates");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data.templates;
}

// Friendly labels + realistic sample values for each variable name Meta
// templates take — pre-filled so sending a test doesn't require staff to
// know what a "dueAmount" is supposed to look like. Matches the examples in
// the templates reference doc so a test send looks like the real thing.
const VARIABLE_LABELS: Record<string, string> = {
  customerName: "Customer Name",
  bookingNumber: "Booking Number",
  productName: "Product Name",
  eventDate: "Event Date",
  rentalStartDate: "Rental Start Date",
  rentalEndDate: "Rental End Date",
  totalAmount: "Total Amount",
  invoiceNumber: "Invoice Number",
  amountDue: "Amount Due",
  amountPaid: "Amount Paid",
  dueDate: "Due Date",
  billNumber: "Bill Number",
  advancePayment: "Advance Paid",
};

const SAMPLE_DEFAULTS: Record<string, string> = {
  customerName: "Priya Sharma",
  bookingNumber: "CTB-2026-01042",
  productName: "Maroon Silk Lehenga",
  eventDate: "12 Oct 2026",
  rentalStartDate: "10 Oct 2026",
  rentalEndDate: "14 Oct 2026",
  totalAmount: "8,500",
  invoiceNumber: "INV-00234",
  amountDue: "3,500",
  amountPaid: "5,000",
  dueDate: "20 Oct 2026",
  billNumber: "00892",
  advancePayment: "2,000",
};

// Any small, public, real PDF — good enough to prove a document-header send
// actually goes through before pointing this field at a real bill/invoice
// link from the app.
const SAMPLE_DOCUMENT_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

export function WhatsAppTestDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [documentUrl, setDocumentUrl] = useState("");
  // Kept visible in the dialog (not just a toast) until the next attempt —
  // Meta's error text is often long (now includes the error code), and a
  // toast that auto-dismisses in a few seconds is too easy to miss.
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["admin", "whatsapp", "templates"],
    queryFn: fetchTemplates,
    enabled: open,
  });

  const selectedTemplate = templates.find((t) => t._id === templateId);
  const variableKeys = selectedTemplate
    ? (TRIGGER_EVENT_VARIABLES[selectedTemplate.triggerEvent] ?? [])
    : [];
  const needsDocument = selectedTemplate?.metaHeaderType === "document";

  // Re-seed sample values whenever a different template is picked, so
  // switching templates doesn't carry over the wrong fields (or leave a
  // newly-needed one blank). Done in the handler itself, not an effect —
  // it's a response to the pick, not a sync with an external system.
  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    const next = templates.find((t) => t._id === nextTemplateId);
    const keys = next ? (TRIGGER_EVENT_VARIABLES[next.triggerEvent] ?? []) : [];
    setVariables(Object.fromEntries(keys.map((key) => [key, SAMPLE_DEFAULTS[key] ?? ""])));
    setDocumentUrl(next?.metaHeaderType === "document" ? SAMPLE_DOCUMENT_URL : "");
  }

  const mutation = useMutation({
    mutationFn: async () => {
      setSendError(null);
      const res = await fetch("/api/admin/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          templateId,
          variables,
          documentUrl: needsDocument ? documentUrl : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Test message sent");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "logs"] });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Test message failed");
      setSendError(error.message);
    },
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" /> Send Test Message
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSendError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Test WhatsApp Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                className="mt-2"
                placeholder="919876543210"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Template</label>
              {isLoadingTemplates ? (
                <Skeleton className="mt-2 h-9 w-full" />
              ) : (
                <Select value={templateId} onValueChange={(value) => handleTemplateChange(value ?? "")}>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue placeholder="Select a template">
                      {() => selectedTemplate?.name ?? "Select a template"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No templates yet.
                      </div>
                    )}
                    {templates.map((template) => (
                      <SelectItem key={template._id} value={template._id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {needsDocument && (
              <div>
                <label className="text-sm font-medium">Document URL</label>
                <Input
                  className="mt-2"
                  placeholder="https://your-site.com/api/invoices/.../pdf"
                  value={documentUrl}
                  onChange={(event) => setDocumentUrl(event.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This template has a document header — Meta will reject the send without a
                  document URL it can fetch. Pre-filled with a sample PDF; swap in a real
                  bill/invoice link to test the actual document.
                </p>
              </div>
            )}

            {variableKeys.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Sample values for this template&rsquo;s placeholders — pre-filled, edit if you
                  want to see different text.
                </p>
                {variableKeys.map((key) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground">
                      {VARIABLE_LABELS[key] ?? key}
                    </label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      value={variables[key] ?? ""}
                      onChange={(event) =>
                        setVariables((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {sendError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="flex-1 text-sm break-words text-destructive">{sendError}</p>
                <button
                  type="button"
                  onClick={() => setSendError(null)}
                  className="shrink-0 text-destructive/70 hover:text-destructive"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={
                !phone ||
                !templateId ||
                (needsDocument && !documentUrl) ||
                mutation.isPending ||
                isLoadingTemplates
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
