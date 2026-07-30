"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button-link";
import type { DressListing } from "@/lib/data/products";

export function TrendingDresses({ dresses }: { dresses: DressListing[] }) {
  return (
    <section className="py-24">
      <div className="container-boutique">
        <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="kicker">Handpicked This Week</span>
            <h2 className="mt-3 font-heading text-4xl sm:text-5xl">Trending Right Now</h2>
          </div>
          <ButtonLink variant="link" className="px-0 text-accent" href="/collections">
            View All Dresses &rarr;
          </ButtonLink>
        </Reveal>
      </div>

      <div className="container-boutique mt-12">
        <Carousel opts={{ align: "start", loop: true }}>
          <CarouselContent>
            {dresses.map((dress) => (
              <CarouselItem key={dress.id} className="basis-4/5 sm:basis-1/2 lg:basis-1/3">
                <Link
                  href={`/collections/${dress.category}`}
                  className="group block overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                    <Image
                      src={dress.image}
                      alt={dress.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 80vw"
                      className="object-cover object-top transition-transform duration-700 group-hover:scale-110"
                    />
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {dress.designer}
                    </p>
                    <h3 className="mt-1 font-heading text-lg">{dress.name}</h3>
                    <p className="mt-1 text-sm text-accent">
                      &#8377;{dress.pricePerDay.toLocaleString("en-IN")}{" "}
                      <span className="text-muted-foreground">rent</span>
                    </p>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-8 flex justify-center gap-3">
            <CarouselPrevious className="static translate-y-0 rounded-none" />
            <CarouselNext className="static translate-y-0 rounded-none" />
          </div>
        </Carousel>
      </div>
    </section>
  );
}
