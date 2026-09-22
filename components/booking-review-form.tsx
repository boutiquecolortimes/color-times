"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Star, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 4;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

interface PendingPhoto {
  file: File;
  previewUrl: string;
}

export function BookingReviewForm({
  token,
  defaultName,
}: {
  token: string;
  defaultName?: string;
}) {
  const [customerName, setCustomerName] = useState(defaultName ?? "");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`You can upload up to ${MAX_PHOTOS} photos`);
      return;
    }

    const accepted: PendingPhoto[] = [];
    for (const file of Array.from(fileList).slice(0, room)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG, WebP, or AVIF images are allowed`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`${file.name}: must be smaller than 8MB`);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    if (accepted.length > 0) {
      setPhotos((prev) => [...prev, ...accepted]);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (rating < 1) {
      toast.error("Please select a star rating");
      return;
    }
    if (photos.length < 1) {
      toast.error("Please upload at least 1 photo");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("customerName", customerName.trim());
      formData.append("rating", String(rating));
      formData.append("comment", comment.trim());
      photos.forEach(({ file }) => formData.append("images", file));

      const res = await fetch(`/api/reviews/${token}`, { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-heading text-xl">Thank You!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your review has been submitted. We really appreciate you taking the time to share it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="customerName">Your Name</Label>
        <Input
          id="customerName"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Your name"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Rating</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  (hoverRating || rating) >= value
                    ? "fill-current text-accent"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="comment">Your Review (optional)</Label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Tell us about your experience..."
          rows={4}
          maxLength={1000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          Photos{" "}
          <span className="font-normal text-muted-foreground">
            (1 to {MAX_PHOTOS}, at least 1 required)
          </span>
        </Label>

        {photos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <div
                key={photo.previewUrl}
                className="group relative h-20 w-20 overflow-hidden rounded-md border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local
                    blob: preview URL, not a remote/optimizable image */}
                <img
                  src={photo.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-charcoal/80 text-ivory"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_PHOTOS && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Add Photo{photos.length > 0 ? "s" : ""}
            </Button>
          </>
        )}
      </div>

      <Button type="submit" className="w-full rounded-none" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit Review
      </Button>
    </form>
  );
}
