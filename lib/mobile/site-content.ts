import "server-only";
import { siteConfig } from "@/lib/config/site";
import {
  faqs,
  rentalProcess,
  stats,
  testimonials,
  whyChooseUs,
} from "@/lib/data/home-content";
import { blogPosts } from "@/lib/data/blog";

/**
 * Copy for the website's static pages, served to the mobile app by
 * /api/mobile/content so the app shows the same About / Offers / Terms /
 * Privacy / Contact text as the site. The site's pages under
 * app/(marketing)/ still hold their own copy — when you edit text there,
 * update it here too (or move those pages to import from this file).
 */

const offers = [
  {
    icon: "Gift",
    code: "FIRSTRENT15",
    title: "15% Off Your First Rental",
    description: "New to Color Times? Get 15% off your first booking, any collection, any occasion.",
  },
  {
    icon: "Users",
    code: "BRINGAFRIEND",
    title: "Refer & Earn ₹500",
    description: "Invite a friend and you both get ₹500 credit once their first rental is delivered.",
  },
  {
    icon: "Sparkles",
    code: "WEEKDAY20",
    title: "20% Off Weekday Bookings",
    description: "Book a Monday–Thursday delivery slot and save 20% on the rental fee.",
  },
  {
    icon: "ShoppingBag",
    code: "BUNDLE3",
    title: "Rent 3, Save 10%",
    description: "Booking three or more pieces for the same event? Get an automatic 10% off the total.",
  },
];

const about = {
  kicker: "Our Story",
  title: "Couture Shouldn't Live in a Closet",
  image: "/images/placeholder/dresses/dress-5.png",
  paragraphs: [
    "Color Times Boutique started with a simple frustration: beautiful designer wear, worn once, then forgotten. We set out to build a rental house that treats every piece — and every customer — the way a couture atelier would: with care, precision, and genuine excitement for the moment you're dressing for.",
    "Today, we work with designers and boutiques across India to curate collections for weddings, festivals, and everything in between, delivering couture-quality fittings without the couture price tag or the guilt of a one-time purchase.",
  ],
};

interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

const contactLine = `${siteConfig.contact.email} or ${siteConfig.contact.phone}`;

const terms: { updated: string; sections: LegalSection[] } = {
  updated: "January 1, 2026",
  sections: [
    {
      heading: "1. Rental Bookings",
      paragraphs: [
        "All bookings are subject to availability at the time of confirmation. A rental period begins on the agreed delivery date and ends on the agreed return date shown at checkout. Rental fees are non-refundable once the item has been dispatched, except as described in our cancellation policy below.",
      ],
    },
    {
      heading: "2. Security Deposit",
      paragraphs: [
        "A refundable security deposit is charged at checkout in addition to the rental fee. The deposit is refunded within 5–7 business days of the item being returned in its original condition, subject to inspection. Deductions may apply for damage, staining, missing accessories, or late returns.",
      ],
    },
    {
      heading: "3. Cancellations & Rescheduling",
      bullets: [
        "Cancellations made 7+ days before the delivery date receive a full refund of the rental fee.",
        "Cancellations made within 3–6 days receive a 50% refund of the rental fee.",
        "Cancellations within 48 hours of delivery are non-refundable.",
        "Rescheduling is permitted once, free of charge, subject to availability.",
      ],
    },
    {
      heading: "4. Care & Damage Policy",
      paragraphs: [
        "Customers are responsible for reasonable care of the garment during the rental period. Normal wear is expected and covered. Significant damage, irreparable staining, or loss of the item will result in a deduction from the security deposit up to the item's listed retail value, communicated to you with photographic evidence before any deduction is made.",
      ],
    },
    {
      heading: "5. Late Returns",
      paragraphs: [
        "Items must be handed over for pickup on the agreed return date. Late returns are charged at the daily rental rate for each additional day, deducted from the security deposit.",
      ],
    },
    {
      heading: "6. Sizing & Exchanges",
      paragraphs: [
        "We offer one free size exchange per booking, subject to availability, if requested at least 3 days before the delivery date. Exchanges requested after dispatch cannot be guaranteed.",
      ],
    },
    {
      heading: "7. Limitation of Liability",
      paragraphs: [
        "Color Times Boutique is not liable for indirect or consequential losses arising from delayed delivery due to circumstances beyond our reasonable control, including courier delays, weather events, or force majeure.",
      ],
    },
    {
      heading: "8. Governing Law",
      paragraphs: [
        "These terms are governed by the laws of India, with courts in Phalodi, Rajasthan having exclusive jurisdiction.",
      ],
    },
    { heading: "9. Contact", paragraphs: [`Questions about these terms can be directed to ${contactLine}.`] },
  ],
};

const privacy: { updated: string; sections: LegalSection[] } = {
  updated: "January 1, 2026",
  sections: [
    {
      heading: "1. Information We Collect",
      paragraphs: [
        "When you create an account, book a rental, or contact us, we collect information such as your name, email address, phone number, delivery address, and payment details. We also collect usage data such as pages visited and items viewed to improve your browsing experience.",
      ],
    },
    {
      heading: "2. How We Use Your Information",
      paragraphs: ["We use your information to:"],
      bullets: [
        "Process and fulfil your rental bookings, including delivery and pickup logistics",
        "Communicate booking confirmations, reminders, and support updates",
        "Process payments and refunds securely through our payment partners",
        "Improve our collections, recommendations, and overall service quality",
        "Send promotional offers, where you have opted in to receive them",
      ],
    },
    {
      heading: "3. Payment Information",
      paragraphs: [
        "All payments are processed through PCI-compliant third-party payment gateways. Color Times Boutique does not store your full card details on its own servers.",
      ],
    },
    {
      heading: "4. Data Sharing",
      paragraphs: [
        "We do not sell your personal information. We share data only with logistics partners (for delivery and pickup), payment processors (for transactions), and when required by law.",
      ],
    },
    {
      heading: "5. Cookies & App Storage",
      paragraphs: [
        "We use cookies (on the website) and secure on-device storage (in the app) to keep you signed in, remember your wishlist, and understand how our services are used. You can clear these at any time, though some features may not function correctly as a result.",
      ],
    },
    {
      heading: "6. Data Security",
      paragraphs: [
        "We use industry-standard encryption and access controls to protect your data. Access to customer information is restricted to authorised personnel who need it to perform their duties.",
      ],
    },
    {
      heading: "7. Your Rights",
      paragraphs: [
        `You may request access to, correction of, or deletion of your personal data at any time by contacting us at ${siteConfig.contact.email}.`,
      ],
    },
    { heading: "8. Contact Us", paragraphs: [`For any privacy-related questions, reach us at ${contactLine}.`] },
  ],
};

export function getMobileSiteContent() {
  return {
    brand: {
      name: siteConfig.name,
      nameHi: siteConfig.nameHi,
      shortName: siteConfig.shortName,
      tagline: siteConfig.tagline,
      description: siteConfig.description,
      url: siteConfig.url,
    },
    contact: {
      ...siteConfig.contact,
      hours: "Tue – Sun, 11:00 AM – 8:00 PM",
      intro:
        "Whether it's a styling consultation or a question about your booking, our team typically responds within 24 hours.",
    },
    social: siteConfig.social,
    stats,
    whyChooseUs,
    rentalProcess,
    testimonials,
    testimonialSummary: "4.9 out of 5 based on 2,300+ Google reviews",
    faqs,
    offers,
    offersNote: "Apply these codes when you book. Offers cannot be combined unless stated otherwise.",
    about,
    blog: blogPosts,
    terms,
    privacy,
  };
}
