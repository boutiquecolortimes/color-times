"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Star, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePreviewDialog } from "@/components/admin/image-preview-dialog";
import { cn } from "@/lib/utils";

// Vercel rejects request bodies over ~4.5MB before our route even runs, and
// a phone camera photo is routinely 4–10MB — so the upload used to fail
// with a non-JSON 413 that surfaced as "Network error". Downscale and
// re-encode on the device first: 2000px is the same cap the server applies
// anyway (see optimize-image.ts), so nothing visible is lost.
const MAX_UPLOAD_DIMENSION = 2000;
const TARGET_UPLOAD_BYTES = 3.5 * 1024 * 1024;

async function compressForUpload(file: File): Promise<File> {
  // Small images in a server-supported format go up untouched.
  const supported = ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type);
  if (supported && file.size <= TARGET_UPLOAD_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Browser can't decode it (e.g. HEIC on Android Chrome) — let the
    // server's own validation produce a clear message.
    return file;
  }

  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size <= TARGET_UPLOAD_BYTES) break;
    quality -= 0.1;
  }
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

interface ImageUploadFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  multiple?: boolean;
}

export function ImageUploadField({ images, onChange, multiple = false }: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [previewIndex, setPreviewIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setCoverImage(index: number) {
    if (index <= 0 || index >= images.length) return;
    const reordered = [images[index], ...images.slice(0, index), ...images.slice(index + 1)];
    onChange(reordered);
    setPreviewIndex(0);
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadFile = await compressForUpload(file);
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      // Platform-level rejections (e.g. 413 from Vercel) come back as plain
      // text/HTML, not our JSON envelope — don't let res.json() throw and
      // masquerade as a network error.
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.data?.url) {
        toast.error(
          json?.error ??
            (res.status === 413
              ? "Photo is too large to upload. Try a smaller photo."
              : `Upload failed (${res.status})`)
        );
        return;
      }

      onChange(multiple ? [...images, json.data.url] : [json.data.url]);
      toast.success("Image uploaded");
    } catch {
      toast.error("Network error while uploading");
    } finally {
      setIsUploading(false);
    }
  }

  function addManualUrl() {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    onChange(multiple ? [...images, trimmed] : [trimmed]);
    setManualUrl("");
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((src, index) => (
            <div
              key={src + index}
              className={cn(
                "group relative h-20 w-20 overflow-hidden rounded-md border",
                index === 0 ? "border-accent ring-1 ring-accent" : "border-border"
              )}
            >
              <button
                type="button"
                onClick={() => setPreviewIndex(index)}
                className="absolute inset-0 h-full w-full cursor-zoom-in"
                aria-label={index === 0 ? "Preview cover image" : `Preview image ${index + 1}`}
              >
                <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              </button>
              {index === 0 && (
                <span className="pointer-events-none absolute bottom-1 left-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Star className="h-2.5 w-2.5 fill-current" />
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-charcoal/80 text-ivory"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <ImagePreviewDialog
        images={images}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onOpenChange={(open) => !open && setPreviewIndex(-1)}
        onSetCover={multiple ? setCoverImage : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload Image
        </Button>

        <Input
          placeholder="...or paste an image path/URL"
          value={manualUrl}
          onChange={(event) => setManualUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addManualUrl();
            }
          }}
          className="max-w-xs"
        />
        <Button type="button" variant="secondary" size="sm" onClick={addManualUrl}>
          Add
        </Button>
      </div>
    </div>
  );
}
