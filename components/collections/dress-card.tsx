"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DressListing } from "@/lib/data/products";

export function DressCard({ dress }: { dress: DressListing }) {
  return (
    <Link
      href={`/collections/${dress.category}`}
      className="group block overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <Image
          src={dress.image}
          alt={dress.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover object-top transition-transform duration-700 group-hover:scale-110"
        />
        {dress.isNewArrival && (
          <Badge className="absolute left-3 top-3 rounded-none bg-accent text-accent-foreground">
            New Arrival
          </Badge>
        )}
        <button
          type="button"
          aria-label="Add to wishlist"
          onClick={(e) => e.preventDefault()}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur transition-colors hover:text-accent"
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{dress.designer}</p>
        <h3 className="mt-1 font-heading text-lg leading-tight">{dress.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm text-accent">
            &#8377;{dress.pricePerDay.toLocaleString("en-IN")}{" "}
            <span className="text-muted-foreground">rent</span>
          </p>
          <p className="text-xs text-muted-foreground">Sizes {dress.sizes.join(", ")}</p>
        </div>
      </div>
    </Link>
  );
}
