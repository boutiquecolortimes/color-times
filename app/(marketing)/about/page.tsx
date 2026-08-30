import type { Metadata } from "next";
import Image from "next/image";
import { Sparkles, ShieldCheck, Ruler, Truck } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { Stats } from "@/components/home/stats";
import { whyChooseUs } from "@/lib/data/home-content";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Color Times Boutique is Rajasthan's premium designer dress rental house, making couture accessible for every celebration.",
  alternates: { canonical: "/about" },
};

const icons = { Sparkles, ShieldCheck, Ruler, Truck } as const;

export default function AboutPage() {
  return (
    <div className="pb-20">
      <section className="container-boutique py-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <span className="kicker">Our Story</span>
            <h1 className="mt-3 font-heading text-4xl sm:text-5xl">
              Couture Shouldn&apos;t Live in a Closet
            </h1>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Color Times Boutique started with a simple frustration: beautiful designer wear,
              worn once, then forgotten. We set out to build a rental house that treats every
              piece — and every customer — the way a couture atelier would: with care, precision,
              and genuine excitement for the moment you&apos;re dressing for.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Today, we work with designers and boutiques across India to curate collections for
              weddings, festivals, and everything in between, delivering couture-quality fittings
              without the couture price tag or the guilt of a one-time purchase.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="relative aspect-[4/5] overflow-hidden rounded-lg">
            <Image
              src="/images/placeholder/dresses/dress-5.png"
              alt="Color Times Boutique founder styling a customer"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-top"
            />
          </Reveal>
        </div>
      </section>

      <Stats />

      <section className="container-boutique py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="kicker">What Sets Us Apart</span>
          <h2 className="mt-3 font-heading text-4xl sm:text-5xl">Our Promise to You</h2>
        </Reveal>

        <RevealGroup className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {whyChooseUs.map((item) => {
            const Icon = icons[item.icon as keyof typeof icons];
            return (
              <RevealItem key={item.title} className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-accent/40">
                  <Icon className="h-7 w-7 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-5 font-heading text-lg">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </section>
    </div>
  );
}
