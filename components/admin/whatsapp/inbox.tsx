"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, Clock, FileText, Loader2, Search, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SendTemplateForm } from "@/components/admin/whatsapp/send-template-form";
import { useMetaTemplates } from "@/components/admin/whatsapp/use-meta-templates";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";
import { MEDIA_TYPES, MessageMedia, type MessageMediaInfo } from "@/components/admin/whatsapp/message-media";
import { cn, formatDateTime } from "@/lib/utils";

interface Conversation {
  waId: string;
  contactName?: string;
  lastText?: string;
  lastDirection: "inbound" | "outbound";
  lastStatus: string;
  lastAt: string;
  unread: number;
}

interface Message {
  _id: string;
  direction: "inbound" | "outbound";
  type: string;
  text?: string;
  templateName?: string;
  media?: MessageMediaInfo;
  status: string;
  errorMessage?: string;
  timestamp: string;
  sentBy?: { name?: string } | null;
}

interface Thread {
  messages: Message[];
  windowOpen: boolean;
  windowOpenUntil: string | null;
}

function StatusTick({ status }: { status: string }) {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-[#667781]" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-red-600" />;
  return <Check className="h-3.5 w-3.5 text-[#667781]" />;
}

function shortTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Older media messages were saved as "[image]" etc. — show them like new ones.
const MEDIA_PREVIEW: Record<string, string> = {
  "[image]": "📷 Photo",
  "[video]": "🎥 Video",
  "[audio]": "🎤 Voice message",
  "[sticker]": "Sticker",
  "[document]": "📄 Document",
};

function previewText(text?: string): string | undefined {
  return text ? (MEDIA_PREVIEW[text] ?? text) : text;
}

export function WhatsAppInbox() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: metaTemplates } = useMetaTemplates();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["admin", "whatsapp", "conversations", search],
    queryFn: () =>
      whatsappApi<{ conversations: Conversation[] }>(
        `/api/admin/whatsapp/conversations${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ).then((d) => d.conversations),
    refetchInterval: 15_000,
  });

  const { data: thread } = useQuery({
    queryKey: ["admin", "whatsapp", "thread", selected],
    queryFn: () => whatsappApi<Thread>(`/api/admin/whatsapp/conversations/${selected}`),
    enabled: selected !== null,
    refetchInterval: 10_000,
  });

  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, selected]);

  const send = useMutation({
    mutationFn: () =>
      whatsappApi(`/api/admin/whatsapp/conversations/${selected}`, { method: "POST", body: { text: reply } }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "thread", selected] });
      queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "conversations"] });
    },
    onError: (err: Error) => toast.error(err.message, { duration: 10000 }),
  });

  const current = conversations.find((c) => c.waId === selected);

  return (
    <div className="grid h-[70vh] min-h-[480px] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[300px_1fr]">
      <aside className={cn("flex min-h-0 flex-col border-r border-border", selected && "hidden md:flex")}>
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No conversations yet. Customer replies appear here once the Meta webhook is subscribed
              (see Overview → Webhooks).
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.waId}
              onClick={() => setSelected(c.waId)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left hover:bg-secondary/50",
                selected === c.waId && "bg-secondary"
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/15 text-sm font-medium text-[#128C7E]">
                {(c.contactName ?? c.waId).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.contactName ?? `+${c.waId}`}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{shortTime(c.lastAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {c.lastDirection === "outbound" && <StatusTick status={c.lastStatus} />}
                  <p className="truncate text-xs text-muted-foreground">{previewText(c.lastText)}</p>
                  {c.unread > 0 && (
                    <span className="ml-auto rounded-full bg-[#25D366] px-1.5 text-[11px] font-medium text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={cn("flex min-h-0 flex-col", !selected && "hidden md:flex")}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            Select a conversation
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{current?.contactName ?? `+${selected}`}</p>
                <p className="text-xs text-muted-foreground">+{selected}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
                <FileText className="h-4 w-4" /> Send template
              </Button>
            </header>
            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4"
              style={{ backgroundColor: "#efeae2" }}
            >
              {thread?.messages.map((m) => (
                <div
                  key={m._id}
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-1.5 text-sm text-[#111b21] shadow-sm",
                    m.direction === "outbound" ? "ml-auto rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
                  )}
                >
                  {m.templateName && (
                    <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[#008069]">
                      Template · {m.templateName}
                    </p>
                  )}
                  {m.media && MEDIA_TYPES.includes(m.type) ? (
                    <>
                      <MessageMedia messageId={m._id} type={m.type} media={m.media} waId={selected ?? ""} />
                      {/* Only a real caption — the "📷 Photo" label is just for the chat list. */}
                      {m.media.caption && (
                        <p className="whitespace-pre-wrap break-words">{m.media.caption}</p>
                      )}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  )}
                  {m.status === "failed" && m.errorMessage && (
                    <p className="mt-1 text-xs text-red-700">{m.errorMessage}</p>
                  )}
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                    {m.sentBy?.name && <span>{m.sentBy.name} ·</span>}
                    <span title={formatDateTime(m.timestamp)}>{shortTime(m.timestamp)}</span>
                    {m.direction === "outbound" && <StatusTick status={m.status} />}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <footer className="border-t border-border p-3">
              {thread && !thread.windowOpen ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  The 24-hour reply window is closed. WhatsApp only allows an approved template until the
                  customer writes back.
                </p>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea
                    rows={2}
                    className="min-h-0 flex-1 resize-none"
                    placeholder="Type a reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && reply.trim()) {
                        e.preventDefault();
                        send.mutate();
                      }
                    }}
                  />
                  <Button onClick={() => send.mutate()} disabled={!reply.trim() || send.isPending}>
                    {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              {thread?.windowOpen && thread.windowOpenUntil && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Free replies allowed until {formatDateTime(thread.windowOpenUntil)}
                </p>
              )}
            </footer>
          </>
        )}
      </section>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Send a template to +{selected}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <SendTemplateForm
              key={selected ?? "none"}
              templates={metaTemplates?.templates ?? []}
              initialPhone={selected ?? ""}
              onSent={() => {
                setTemplateOpen(false);
                queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "thread", selected] });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
