import { siteConfig } from "@/lib/config/site";

// Rendered once (offline) from the boutique's printed Hindi terms &
// conditions and stored as a static image. jsPDF's built-in fonts only
// support Latin text, and even with a Devanagari font embedded it doesn't
// perform the glyph shaping (conjuncts, matra reordering) that Hindi needs —
// so drawing this as real PDF text renders it wrong. An image sidesteps
// that entirely.
export const TERMS_IMAGE_PATH = "/documents/terms-hindi.png";
// height / width of the source PNG (2700x585) — used to keep the image's
// aspect ratio when it's scaled down to fit the page width.
export const TERMS_IMAGE_RATIO = 585 / 2700;

/** Owner/proprietor detail lines, printed under the boutique's address on
 * every generated bill/receipt (invoice, sale bill, customisation bill). */
export function ownerDetailLines(): string[] {
  const { proprietor } = siteConfig;
  return [
    proprietor.printTagline,
    `By: ${proprietor.name}   Mobile: ${proprietor.phones.join(", ")}`,
    `Instagram: ${proprietor.instagramHandle}`,
  ];
}
