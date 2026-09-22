"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { ImagePreviewDialog } from "@/components/admin/image-preview-dialog";
import { cn, formatDateTime } from "@/lib/utils";

interface ReviewRow {
  _id: string;
  customerName: string;
  rating: number;
  comment?: string;
  images: string[];
  createdAt: string;
  booking: { _id: string; bookingNumber: string } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function fetchReviews(params: {
  page: number;
  rating: string;
  search: string;
}): Promise<{ reviews: ReviewRow[]; pagination: Pagination }> {
  const searchParams = new URLSearchParams({ page: String(params.page) });
  if (params.rating !== "all") searchParams.set("rating", params.rating);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(`/api/admin/reviews?${searchParams.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.data;
}

export function ReviewsClient() {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState("all");
  const [search, setSearch] = useState("");
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(-1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reviews", { page, rating, search }],
    queryFn: () => fetchReviews({ page, rating, search }),
  });

  const reviews = data?.reviews ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customer, booking, or review text..."
            className="w-72 pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={rating}
          onValueChange={(value) => {
            setRating(value ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue>
              {(value: string) =>
                value === "all" ? "All Ratings" : `${value} Star${value === "1" ? "" : "s"}`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value} Star{value === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review._id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{review.customerName}</p>
                  {review.booking && (
                    <Link
                      href={`/admin/bookings/${review.booking._id}`}
                      className="text-xs text-accent hover:underline"
                    >
                      {review.booking.bookingNumber}
                    </Link>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      className={cn(
                        "h-3.5 w-3.5",
                        value <= review.rating
                          ? "fill-current text-accent"
                          : "text-muted-foreground/40"
                      )}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{formatDateTime(review.createdAt)}</p>
            </div>

            {review.comment && <p className="mt-2 text-sm">{review.comment}</p>}

            {review.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {review.images.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      setPreviewImages(review.images);
                      setPreviewIndex(index);
                    }}
                    className="relative h-16 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-md"
                    aria-label={`Preview review photo ${index + 1}`}
                  >
                    <Image src={src} alt="" fill sizes="64px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {!isLoading && reviews.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            No reviews yet. Reviews appear here once a customer submits one from their review
            link.
          </p>
        )}
      </div>

      {pagination && (
        <AdminPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          itemLabel="reviews"
          onPageChange={setPage}
        />
      )}

      <ImagePreviewDialog
        images={previewImages}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onOpenChange={(open) => !open && setPreviewIndex(-1)}
        title="Review Photos"
      />
    </div>
  );
}
