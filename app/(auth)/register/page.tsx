import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Ruler, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { RegisterForm } from "@/components/forms/register-form";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a Color Times Boutique account to book, track, and manage your rentals.",
  alternates: { canonical: "/register" },
};

const BENEFITS = [
  { icon: Sparkles, text: "A curated designer edit, handpicked for every occasion" },
  { icon: Ruler, text: "Free size exchange and a personal styling consultation" },
  { icon: Truck, text: "Doorstep delivery and pickup, on your schedule" },
  { icon: ShieldCheck, text: "Hygienically cleaned and steam-sanitised after every rental" },
];

export default function RegisterPage() {
  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden bg-secondary/20 px-4 py-10 sm:px-6">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gold)" }}
      />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/[0.08] lg:grid-cols-2">
        {/* Brand panel — desktop only, form is the whole card on mobile */}
        <div
          className="hidden flex-col justify-between p-10 text-ivory lg:flex"
          style={{ background: "linear-gradient(160deg, var(--charcoal) 0%, var(--primary) 130%)" }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-white/90 p-1">
                <Image
                  src="/logo-icon.png"
                  alt={siteConfig.name}
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
              </span>
              <span className="font-heading text-lg">{siteConfig.name}</span>
            </div>

            <h1 className="mt-14 font-heading text-3xl leading-tight text-white xl:text-4xl">
              Your wardrobe, without the weight of ownership.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ivory/70">
              Join Color Times to rent designer wear for weddings, festivals, and every celebration
              in between — no purchase, no storage, no compromise.
            </p>
          </div>

          <ul className="mt-10 space-y-4">
            {BENEFITS.map((benefit) => (
              <li key={benefit.text} className="flex items-start gap-3 text-sm text-ivory/85">
                <benefit.icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={1.75} />
                <span className="leading-relaxed">{benefit.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
            <Image
              src="/logo.png"
              alt={siteConfig.name}
              width={72}
              height={72}
              priority
              className="h-16 w-16 object-contain"
            />
            <span className="font-heading text-lg">{siteConfig.name}</span>
          </div>

          <span className="kicker">Join Us</span>
          <h2 className="mt-2 font-heading text-2xl sm:text-3xl">Create Your Account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Takes less than a minute — no credit card required.
          </p>

          <div className="mt-8">
            <RegisterForm />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
