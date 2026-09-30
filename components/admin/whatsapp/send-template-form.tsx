"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaTemplatePreview } from "@/components/admin/whatsapp/template-preview";
import { whatsappApi, type ApiError } from "@/lib/whatsapp/client-fetch";
import {
  countPositionalParams,
  fillPositional,
  getComponent,
  type MetaTemplate,
} from "@/lib/whatsapp/meta-types";

interface FormState {
  header: string[];
  body: string[];
  urlButtons: Record<number, string>;
  mediaLink: string;
  filename: string;
}

function initialState(template: MetaTemplate | undefined): FormState {
  if (!template) return { header: [], body: [], urlButtons: {}, mediaLink: "", filename: "" };
  const header = getComponent(template, "HEADER");
  const body = getComponent(template, "BODY");
  const bodyCount = countPositionalParams(body?.text);
  const headerCount = header?.format === "TEXT" ? countPositionalParams(header.text) : 0;
  return {
    header: Array.from({ length: headerCount }, (_, i) => header?.example?.header_text?.[i] ?? ""),
    body: Array.from({ length: bodyCount }, (_, i) => body?.example?.body_text?.[0]?.[i] ?? ""),
    urlButtons: {},
    mediaLink: "",
    filename: "",
  };
}

/** Sends any approved Meta template — every variable the template needs becomes a field. */
export function SendTemplateForm({
  templates,
  initialTemplateId,
  initialPhone = "",
  onSent,
}: {
  templates: MetaTemplate[];
  initialTemplateId?: string;
  initialPhone?: string;
  onSent?: () => void;
}) {
  const queryClient = useQueryClient();
  const approved = templates.filter((t) => t.status === "APPROVED");
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const template = approved.find((t) => t.id === templateId);
  const [phone, setPhone] = useState(initialPhone);
  const [recipientName, setRecipientName] = useState("");
  const [form, setForm] = useState<FormState>(() => initialState(template));
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);

  const header = template ? getComponent(template, "HEADER") : undefined;
  const mediaType =
    header?.format === "DOCUMENT" ? "document" : header?.format === "IMAGE" ? "image" : header?.format === "VIDEO" ? "video" : null;
  const urlButtons = (template ? getComponent(template, "BUTTONS")?.buttons ?? [] : [])
    .map((button, index) => ({ button, index }))
    .filter(({ button }) => button.type === "URL" && /\{\{\s*1\s*\}\}/.test(button.url ?? ""));

  function pick(id: string) {
    setTemplateId(id);
    setForm(initialState(approved.find((t) => t.id === id)));
    setError(null);
  }

  const previewText = template
    ? [
        header?.format === "TEXT" && header.text ? fillPositional(header.text, form.header) : null,
        fillPositional(getComponent(template, "BODY")?.text ?? "", form.body),
        getComponent(template, "FOOTER")?.text ?? null,
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  const send = useMutation({
    mutationFn: () =>
      whatsappApi("/api/admin/whatsapp/send", {
        method: "POST",
        body: {
          to: phone,
          recipientName: recipientName || undefined,
          templateName: template!.name,
          language: template!.language,
          headerText: form.header.length ? form.header : undefined,
          headerMedia: mediaType
            ? { type: mediaType, link: form.mediaLink, filename: form.filename || undefined }
            : undefined,
          bodyParams: form.body.length ? form.body : undefined,
          urlButtonParams: urlButtons.map(({ index }) => ({ index, text: form.urlButtons[index] ?? "" })),
          previewText,
        },
      }),
    onSuccess: () => {
      toast.success(`Sent “${template?.name}” to ${phone}`);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp"] });
      onSent?.();
    },
    onError: (err: ApiError) =>
      setError({
        message: err.message,
        details: err.metaError ? JSON.stringify(err.metaError, null, 2) : undefined,
      }),
  });

  const missing =
    !template ||
    phone.replace(/\D/g, "").length < 10 ||
    form.body.some((v) => !v.trim()) ||
    form.header.some((v) => !v.trim()) ||
    (mediaType !== null && !form.mediaLink.trim()) ||
    urlButtons.some(({ index }) => !form.urlButtons[index]?.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Phone number</label>
            <Input className="mt-2" placeholder="919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">10-digit Indian numbers get +91 automatically.</p>
          </div>
          <div>
            <label className="text-sm font-medium">Customer name (for the log)</label>
            <Input className="mt-2" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Template</label>
          <Select value={templateId} onValueChange={(v) => pick(v ?? "")}>
            <SelectTrigger className="mt-2 w-full">
              <SelectValue placeholder="Select an approved template">
                {() => (template ? `${template.name} (${template.language})` : "Select an approved template")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {approved.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No approved templates.</div>
              )}
              {approved.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.language})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mediaType && (
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div>
              <label className="text-sm font-medium">Header {mediaType} URL</label>
              <Input
                className="mt-2"
                placeholder="https://… (must be publicly reachable)"
                value={form.mediaLink}
                onChange={(e) => setForm((p) => ({ ...p, mediaLink: e.target.value }))}
              />
            </div>
            {mediaType === "document" && (
              <div>
                <label className="text-sm font-medium">File name</label>
                <Input
                  className="mt-2"
                  placeholder="Bill-00892.pdf"
                  value={form.filename}
                  onChange={(e) => setForm((p) => ({ ...p, filename: e.target.value }))}
                />
              </div>
            )}
          </div>
        )}

        {form.header.map((value, i) => (
          <div key={`h${i}`}>
            <label className="text-sm font-medium">Header {`{{${i + 1}}}`}</label>
            <Input
              className="mt-2"
              value={value}
              onChange={(e) =>
                setForm((p) => ({ ...p, header: p.header.map((v, j) => (j === i ? e.target.value : v)) }))
              }
            />
          </div>
        ))}

        {form.body.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {form.body.map((value, i) => (
              <div key={`b${i}`}>
                <label className="text-sm font-medium">Body {`{{${i + 1}}}`}</label>
                <Input
                  className="mt-2"
                  value={value}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, body: p.body.map((v, j) => (j === i ? e.target.value : v)) }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {urlButtons.map(({ button, index }) => (
          <div key={`u${index}`}>
            <label className="text-sm font-medium">“{button.text}” link — value for {"{{1}}"}</label>
            <Input
              className="mt-2"
              placeholder={button.url}
              value={form.urlButtons[index] ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, urlButtons: { ...p.urlButtons, [index]: e.target.value } }))
              }
            />
          </div>
        ))}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            <p className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error.message}
            </p>
            {error.details && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{error.details}</pre>
            )}
          </div>
        )}

        <Button onClick={() => send.mutate()} disabled={missing || send.isPending}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
          message
        </Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Preview</p>
        {template ? (
          <MetaTemplatePreview template={template} values={{ header: form.header, body: form.body }} />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Pick a template to see it here.
          </p>
        )}
      </div>
    </div>
  );
}
