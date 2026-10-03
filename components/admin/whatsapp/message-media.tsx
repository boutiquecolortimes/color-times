"use client";

import { useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, ImageIcon, Loader2, Mic, Video } from "lucide-react";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";

export const MEDIA_TYPES = ["image", "video", "audio", "sticker", "document"];

export interface MessageMediaInfo {
  mimeType?: string;
  filename?: string;
  caption?: string;
  url?: string;
  downloadUrl?: string;
  size?: number;
  error?: string;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PLACEHOLDER: Record<string, { icon: typeof ImageIcon; label: string }> = {
  image: { icon: ImageIcon, label: "Photo" },
  sticker: { icon: ImageIcon, label: "Sticker" },
  video: { icon: Video, label: "Video" },
  audio: { icon: Mic, label: "Voice message" },
  document: { icon: FileText, label: "Document" },
};

/**
 * Photo / video / voice note / document inside an Inbox bubble. Shows the
 * stored copy (with Open + Download), or — if it hasn't been copied from
 * Meta yet — a placeholder with a Load button.
 */
export function MessageMedia({
  messageId,
  type,
  media,
  waId,
}: {
  messageId: string;
  type: string;
  media: MessageMediaInfo;
  waId: string;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      await whatsappApi(`/api/admin/whatsapp/media/${messageId}`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "whatsapp", "thread", waId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load this file");
    } finally {
      setLoading(false);
    }
  }

  if (!media.url) {
    const { icon: Icon, label } = PLACEHOLDER[type] ?? PLACEHOLDER.document;
    return (
      <div className="mb-1 flex min-w-[200px] items-center gap-3 rounded-md bg-black/5 p-3">
        <Icon className="h-6 w-6 shrink-0 text-[#667781]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{media.filename ?? label}</p>
          <p className="text-[11px] text-[#667781]">
            {media.error ? media.error : "Not loaded yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="shrink-0 rounded-md border border-[#008069]/40 px-2 py-1 text-xs font-medium text-[#008069] hover:bg-[#008069]/10 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : media.error ? "Retry" : "Load"}
        </button>
      </div>
    );
  }

  const download = media.downloadUrl ?? media.url;
  const actions = (
    <div className="mt-1 flex items-center gap-3 text-[11px] font-medium text-[#008069]">
      <a href={media.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
        <ExternalLink className="h-3 w-3" /> Open
      </a>
      <a href={download} className="flex items-center gap-1 hover:underline">
        <Download className="h-3 w-3" /> Download
      </a>
      {media.size ? <span className="font-normal text-[#667781]">{formatSize(media.size)}</span> : null}
    </div>
  );

  if (type === "image" || type === "sticker") {
    return (
      <div className="mb-1">
        <a href={media.url} target="_blank" rel="noopener noreferrer" title="Open full size">
          <Image
            src={media.url}
            alt={media.caption ?? (type === "sticker" ? "Sticker" : "Photo from customer")}
            width={288}
            height={288}
            unoptimized
            className={
              type === "sticker"
                ? "h-32 w-32 object-contain"
                : "h-auto max-h-72 w-auto max-w-full rounded-md object-contain"
            }
          />
        </a>
        {type === "image" && actions}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mb-1">
        <video src={media.url} controls preload="metadata" className="max-h-72 max-w-full rounded-md" />
        {actions}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mb-1">
        <audio src={media.url} controls preload="metadata" className="w-64 max-w-full" />
        {actions}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <a
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-[200px] items-center gap-3 rounded-md bg-black/5 p-3 hover:bg-black/10"
      >
        <FileText className="h-6 w-6 shrink-0 text-[#667781]" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{media.filename ?? "Document"}</span>
      </a>
      {actions}
    </div>
  );
}
