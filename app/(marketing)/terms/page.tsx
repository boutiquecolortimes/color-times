import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms and conditions governing rentals from Color Times Boutique.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="container-boutique max-w-3xl py-20">
      <span className="kicker">Legal</span>
      <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Terms &amp; Conditions</h1>
      <p className="mt-4 text-sm text-muted-foreground">Last updated: January 1, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90 sm:text-base">
        <section>
          <h2 className="font-heading text-xl">1. Rental Bookings</h2>
          <p className="mt-3">
            All bookings are subject to availability at the time of confirmation. A rental period
            begins on the agreed delivery date and ends on the agreed return date shown at
            checkout. Rental fees are non-refundable once the item has been dispatched, except as
            described in our cancellation policy below.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl">2. Security Deposit</h2>
          <p className="mt-3">
            A refundable security deposit is charged at checkout in addition to the rental fee.
            The deposit is refunded within 5–7 business days of the item being returned in its
            original condition, subject to inspection. Deductions may apply for damage, staining,
            missing accessories, or late returns.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl">3. Cancellations &amp; Rescheduling</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Cancellations made 7+ days before the delivery date receive a full refund of the rental fee.</li>
            <li>Cancellations made within 3–6 days receive a 50% refund of the rental fee.</li>
            <li>Cancellations within 48 hours of delivery are non-refundable.</li>
            <li>Rescheduling is permitted once, free of charge, subject to availability.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl">4. Care &amp; Damage Policy</h2>
          <p className="mt-3">
            Customers are responsible for reasonable care of the garment during the rental period.
            Normal wear is expected and covered. Significant damage, irreparable staining, or loss
            of the item will result in a deduction from the security deposit up to the item&apos;s
            listed retail value, communicated to you with photographic evidence before any
            deduction is made.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl">5. Late Returns</h2>
          <p className="mt-3">
            Items must be handed over for pickup on the agreed return date. Late returns are
            charged at the daily rental rate for each additional day, deducted from the security
            deposit.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl">6. Sizing &amp; Exchanges</h2>
          <p className="mt-3">
            We offer one free size exchange per booking, subject to availability, if requested at
            least 3 days before the delivery date. Exchanges requested after dispatch cannot be
            guaranteed.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl">7. Limitation of Liability</h2>
          <p className="mt-3">
            Color Times Boutique is not liable for indirect or consequential losses arising from
            delayed delivery due to circumstances beyond our reasonable control, including courier
            delays, weather events, or force majeure.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl">8. Governing Law</h2>
          <p className="mt-3">
            These terms are governed by the laws of India, with courts in Phalodi, Rajasthan
            having exclusive jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl">9. Contact</h2>
          <p className="mt-3">
            Questions about these terms can be directed to {siteConfig.contact.email} or{" "}
            {siteConfig.contact.phone}.
          </p>
        </section>
      </div>
    </div>
  );
}
