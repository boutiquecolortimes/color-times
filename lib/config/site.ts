interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

const nav: NavItem[] = [
  { label: "Home", href: "/home" },
  {
    label: "Collections",
    href: "/collections",
    children: [
      { label: "Wedding Collection", href: "/collections/wedding" },
      { label: "Bridal Collection", href: "/collections/bridal" },
      { label: "Party Wear", href: "/collections/party-wear" },
      { label: "Festival Collection", href: "/collections/festival" },
      { label: "Designer Collection", href: "/collections/designer" },
      { label: "Accessories", href: "/collections/accessories" },
    ],
  },
  { label: "Offers", href: "/offers" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const siteConfig = {
  name: "Color Times Boutique",
  shortName: "Color Times",
  tagline: "Wear the Moment",
  description:
    "Color Times Boutique is a premium designer dress rental house for weddings, festivals, and celebrations — curated collections, couture fittings, and white-glove delivery.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://colortimesboutique.com",
  ogImage: "/images/placeholder/brand/logo.png",
  keywords: [
    "designer dress rental",
    "boutique dress rental",
    "wedding dress rental",
    "party wear rental",
    "bridal collection rental",
    "festival dresses on rent",
    "luxury dress rental India",
  ],
  contact: {
    phone: "+91 98765 43210",
    whatsapp: "+91 98765 43210",
    email: "hello@colortimesboutique.com",
    address: "Balaji Market, Main Pathar Road, Phalodi (Raj.) 342301",
  },
  social: {
    instagram: "https://www.instagram.com/color_times_boutique/",
    facebook: "https://facebook.com/colortimesboutique",
    pinterest: "https://pinterest.com/colortimesboutique",
  },
  // Proprietor details as printed on physical bills/receipts (order slips,
  // sale bills, customisation bills). Kept separate from `contact` and
  // `social` above, which drive the public website, so this can carry the
  // owner's real details without touching website copy.
  proprietor: {
    name: "Neelam Soni",
    printTagline: "You Choose, We Design",
    phones: ["7891919789", "9509786777"],
    instagramHandle: "Color_times_boutique",
  },
  nav,
  footerLinks: {
    shop: [
      { label: "Wedding Collection", href: "/collections/wedding" },
      { label: "Party Wear", href: "/collections/party-wear" },
      { label: "Festival Collection", href: "/collections/festival" },
      { label: "Bridal Collection", href: "/collections/bridal" },
      { label: "Designer Collection", href: "/collections/designer" },
      { label: "Accessories", href: "/collections/accessories" },
    ],
    company: [
      { label: "About Us", href: "/about" },
      { label: "Gallery", href: "/gallery" },
      { label: "Blog", href: "/blog" },
      { label: "Testimonials", href: "/testimonials" },
      { label: "Contact", href: "/contact" },
    ],
    support: [
      { label: "FAQ", href: "/faq" },
      { label: "Order Tracking", href: "/order-tracking" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms & Conditions", href: "/terms" },
    ],
  },
} as const;

export type SiteConfig = typeof siteConfig;
