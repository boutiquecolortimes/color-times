import "server-only";
import { put } from "@vercel/blob";
import { GRAPH_API_VERSION } from "@/lib/notifications/meta-whatsapp";
import { WhatsAppMessage } from "@/models/WhatsAppMessage";

// Incoming WhatsApp photos, videos, voice notes, stickers and documents.
//
// Meta's webhook only sends a media ID. To show the file in the Inbox:
//   1. GET graph.facebook.com/{version}/{media_id} → a short-lived download URL
//   2. GET that URL with the same Bearer token     → the file itself
//   3. Store it in Vercel Blob                     → a permanent URL
// The permanent URL is saved on the message (media.url). Meta keeps the
// file for roughly 30 days, so older messages can still be fetched later
// through the Inbox's "Load" button.

export const MEDIA_MESSAGE_TYPES = ["image", "video", "audio", "sticker", "document"] as const;

// Vercel functions hold the whole file in memory while copying it.
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

function extensionFor(mimeType: string | undefined, filename: string | undefined): string {
  const fromName = filename?.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  if (fromName) return fromName.toLowerCase();
  const base = mimeType?.split(";")[0].trim().toLowerCase() ?? "";
  return EXTENSIONS[base] ?? "bin";
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export type StoreMediaResult =
  | { ok: true; url: string; downloadUrl: string; size: number; mimeType?: string }
  | { ok: false; error: string };

/** Downloads one media file from Meta and stores it in Vercel Blob. */
export async function downloadMetaMediaToBlob(input: {
  mediaId: string;
  waId: string;
  mimeType?: string;
  filename?: string;
}): Promise<StoreMediaResult> {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "META_WHATSAPP_ACCESS_TOKEN is not set" };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "BLOB_READ_WRITE_TOKEN is not set" };

  // 1. Media ID → temporary download URL
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${input.mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const meta = (await metaRes.json().catch(() => ({}))) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
    error?: { message?: string };
  };
  if (!metaRes.ok || !meta.url) {
    return {
      ok: false,
      error: meta.error?.message
        ? `Meta: ${meta.error.message}`
        : `Meta couldn't find this media (HTTP ${metaRes.status}) — it may have expired`,
    };
  }
  if (meta.file_size && meta.file_size > MAX_MEDIA_BYTES) {
    return { ok: false, error: `File is too large to copy (${Math.round(meta.file_size / 1048576)} MB)` };
  }

  // 2. Download the file — Meta's media URLs need the same Bearer token.
  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!fileRes.ok) {
    return { ok: false, error: `Couldn't download the file from Meta (HTTP ${fileRes.status})` };
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  if (buffer.byteLength > MAX_MEDIA_BYTES) {
    return { ok: false, error: "File is too large to copy" };
  }

  // 3. Store permanently. addRandomSuffix makes the URL unguessable.
  const mimeType = meta.mime_type ?? input.mimeType;
  const name = input.filename
    ? safeName(input.filename)
    : `${input.mediaId}.${extensionFor(mimeType, undefined)}`;
  const blob = await put(`whatsapp/${input.waId}/${name}`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: mimeType?.split(";")[0].trim() || "application/octet-stream",
  });

  return { ok: true, url: blob.url, downloadUrl: blob.downloadUrl, size: buffer.byteLength, mimeType };
}

/**
 * Copies a stored message's media into Blob and saves the permanent URL on
 * the message. Safe to call again — already-stored media is left alone.
 * Never throws: on failure the reason is saved as media.error.
 */
export async function storeMessageMedia(messageId: string): Promise<StoreMediaResult | null> {
  const message = await WhatsAppMessage.findById(messageId).select("waId media").lean();
  if (!message?.media?.id) return null;
  if (message.media.url) {
    return {
      ok: true,
      url: message.media.url,
      downloadUrl: message.media.downloadUrl ?? message.media.url,
      size: message.media.size ?? 0,
      mimeType: message.media.mimeType,
    };
  }

  let result: StoreMediaResult;
  try {
    result = await downloadMetaMediaToBlob({
      mediaId: message.media.id,
      waId: message.waId,
      mimeType: message.media.mimeType,
      filename: message.media.filename,
    });
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }

  if (result.ok) {
    await WhatsAppMessage.updateOne(
      { _id: messageId },
      {
        $set: {
          "media.url": result.url,
          "media.downloadUrl": result.downloadUrl,
          "media.size": result.size,
          ...(result.mimeType ? { "media.mimeType": result.mimeType } : {}),
          "media.storedAt": new Date(),
        },
        $unset: { "media.error": "" },
      }
    );
  } else {
    console.error(`WhatsApp media ${message.media.id} not stored:`, result.error);
    await WhatsAppMessage.updateOne({ _id: messageId }, { $set: { "media.error": result.error } });
  }
  return result;
}
