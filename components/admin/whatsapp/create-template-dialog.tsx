"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaTemplatePreview } from "@/components/admin/whatsapp/template-preview";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";
import { countPositionalParams, type MetaTemplateComponent } from "@/lib/whatsapp/meta-types";

type ButtonDraft =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phone_number: string };

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "hi", label: "Hindi" },
  { code: "gu", label: "Gujarati" },
  { code: "mr", label: "Marathi" },
  { code: "pa", label: "Punjabi" },
];

const EMPTY = {
  name: "",
  category: "UTILITY" as "UTILITY" | "MARKETING",
  language: "en",
  headerText: "",
  headerExample: "",
  body: "",
  bodyExamples: [] as string[],
  footer: "Color Times Boutique",
  buttons: [] as ButtonDraft[],
};

export function CreateTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const bodyVars = countPositionalParams(draft.body);
  const headerVars = countPositionalParams(draft.headerText);
  const examples = Array.from({ length: bodyVars }, (_, i) => draft.bodyExamples[i] ?? "");

  const previewComponents: MetaTemplateComponent[] = [
    ...(draft.headerText
      ? [{ type: "HEADER", format: "TEXT", text: draft.headerText, example: { header_text: [draft.headerExample] } }]
      : []),
    { type: "BODY", text: draft.body || "Your message…", example: { body_text: [examples] } },
    ...(draft.footer ? [{ type: "FOOTER", text: draft.footer }] : []),
    ...(draft.buttons.length ? [{ type: "BUTTONS", buttons: draft.buttons }] : []),
  ];

  const create = useMutation({
    mutationFn: () =>
      whatsappApi("/api/admin/whatsapp/meta-templates", {
        method: "POST",
        body: {
          ...draft,
          headerText: draft.headerText || undefined,
          headerExample: draft.headerExample || undefined,
          footer: draft.footer || undefined,
          bodyExamples: examples,
        },
      }),
    onSuccess: () => {
      toast.success("Template submitted to Meta for review");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "meta-templates"] });
      setDraft(EMPTY);
      setError(null);
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  function updateButton(index: number, patch: Partial<ButtonDraft>) {
    setDraft((d) => ({
      ...d,
      buttons: d.buttons.map((b, i) => (i === index ? ({ ...b, ...patch } as ButtonDraft) : b)),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>New WhatsApp template</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[72vh] gap-6 overflow-y-auto pr-1 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="text-sm font-medium">Name</label>
                <Input
                  className="mt-2 font-mono"
                  placeholder="alteration_ready"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={draft.category} onValueChange={(v) => setDraft((d) => ({ ...d, category: (v as "UTILITY" | "MARKETING") ?? "UTILITY" }))}>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Language</label>
                <Select value={draft.language} onValueChange={(v) => setDraft((d) => ({ ...d, language: v ?? "en" }))}>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue>{(v: string) => LANGUAGES.find((l) => l.code === v)?.label ?? v}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.label} ({l.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Utility = order, booking and payment updates. Marketing = offers and promotions (charged
              higher, needs customer opt-in).
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Header text (optional)</label>
                <Input className="mt-2" maxLength={60} value={draft.headerText} onChange={(e) => setDraft((d) => ({ ...d, headerText: e.target.value }))} />
              </div>
              {headerVars > 0 && (
                <div>
                  <label className="text-sm font-medium">Header example for {"{{1}}"}</label>
                  <Input className="mt-2" value={draft.headerExample} onChange={(e) => setDraft((d) => ({ ...d, headerExample: e.target.value }))} />
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Body</label>
              <Textarea
                className="mt-2"
                rows={5}
                maxLength={1024}
                placeholder="Hello {{1}}, your alteration for {{2}} is ready for pickup."
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use {"{{1}}"}, {"{{2}}"}… for values filled in at send time. {draft.body.length}/1024
              </p>
            </div>

            {bodyVars > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {examples.map((value, i) => (
                  <div key={i}>
                    <label className="text-sm font-medium">Example for {`{{${i + 1}}}`}</label>
                    <Input
                      className="mt-2"
                      value={value}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = [...examples];
                          next[i] = e.target.value;
                          return { ...d, bodyExamples: next };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Footer (optional)</label>
              <Input className="mt-2" maxLength={60} value={draft.footer} onChange={(e) => setDraft((d) => ({ ...d, footer: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Buttons (optional)</label>
                <div className="flex gap-1">
                  {(["QUICK_REPLY", "URL", "PHONE_NUMBER"] as const).map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      size="xs"
                      disabled={draft.buttons.length >= 3}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          buttons: [
                            ...d.buttons,
                            type === "URL"
                              ? { type, text: "", url: "https://" }
                              : type === "PHONE_NUMBER"
                                ? { type, text: "Call us", phone_number: "+91" }
                                : { type, text: "" },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3 w-3" />
                      {type === "QUICK_REPLY" ? "Reply" : type === "URL" ? "Link" : "Call"}
                    </Button>
                  ))}
                </div>
              </div>
              {draft.buttons.map((button, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                  <span className="w-12 text-xs text-muted-foreground">
                    {button.type === "QUICK_REPLY" ? "Reply" : button.type === "URL" ? "Link" : "Call"}
                  </span>
                  <Input className="w-36" maxLength={25} placeholder="Button text" value={button.text} onChange={(e) => updateButton(i, { text: e.target.value })} />
                  {button.type === "URL" && (
                    <Input
                      className="min-w-48 flex-1"
                      placeholder="https://colortimesboutique.com/review/{{1}}"
                      value={button.url}
                      onChange={(e) => updateButton(i, { url: e.target.value })}
                    />
                  )}
                  {button.type === "PHONE_NUMBER" && (
                    <Input className="flex-1" value={button.phone_number} onChange={(e) => updateButton(i, { phone_number: e.target.value })} />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDraft((d) => ({ ...d, buttons: d.buttons.filter((_, j) => j !== i) }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {draft.buttons.some((b) => b.type === "URL") && (
                <p className="text-xs text-muted-foreground">
                  End a link with {"{{1}}"} to make it different for each customer (e.g. a review link per booking).
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Templates with a PDF or image header (like bills) need a sample file uploaded — create
              those in WhatsApp Manager, then they appear here automatically.
            </p>

            {error && (
              <p className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Preview</p>
            <MetaTemplatePreview template={{ components: previewComponents }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !draft.name || !draft.body || examples.some((e) => !e.trim())}
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
