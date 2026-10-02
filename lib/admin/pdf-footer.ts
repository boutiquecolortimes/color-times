import type { jsPDF } from "jspdf";
import { siteConfig } from "@/lib/config/site";

// Terms & conditions, word-for-word from the boutique's booking slip.
// English is drawn as real jsPDF text (Latin renders fine). The Hindi
// version can't be — jsPDF doesn't do Devanagari glyph shaping — so the
// Hindi invoice download renders TERMS_AND_CONDITIONS_HI through a browser
// canvas instead (see lib/admin/hindi-canvas.ts). Keep both lists in step.
export const TERMS_AND_CONDITIONS: string[] = [
  "The booking will be 100% confirmed only after the customer deposits the advance amount.",
  "Once the dress is booked, it cannot be cancelled. If cancelled, the advance deposit will not be refunded.",
  "Once the dress is booked, no changes can be made to the dress or the date.",
  "If the customer returns the dress late, or if the dress is stained or torn, an extra amount will be deducted from the security deposit.",
  "The full rent and security deposit must be paid before taking the dress, and the dress and fitting must be checked before taking it. The jurisdiction of all matters will be Phalodi.",
];

export const TERMS_AND_CONDITIONS_HEADING = "Terms and Conditions";

export const TERMS_AND_CONDITIONS_HI: string[] = [
  "ग्राहक द्वारा एडवांस रुपये जमा करवाने पर ही बुकिंग 100% कंफर्म होगी ।",
  "ड्रेस बुक हो जाने के बाद उसे कैंसिल नहीं किया जाएगा यदि कैंसिल किया जाता है तो एडवांस जमा रुपये वापस नहीं होगें।",
  "ड्रेस बुक हो जाने के बाद ड्रेस और तारीख में कोई बदलाव नहीं किया जाएगा ।",
  "ग्राहक द्वारा ड्रेस लेट पहुंचाने पर या ड्रेस पर दाग या कटी फटी करने पर जमा सिक्योरिटी रुपये से एक्स्ट्रा रुपये काट लिए जाएगें ।",
  "ड्रेस ले जाने से पहले पूरा किराया और सिक्योरिटी देनी होगी एवं ड्रेस ले जाने से पहले ड्रेस व फिटिंग जरूर जाँच कर लेवें। सभी प्रसंगों का न्याय क्षेत्र फलोदी होगा।",
];

export const TERMS_AND_CONDITIONS_HEADING_HI = "नियम एवं शर्तें";

/**
 * Draws the "Terms & Conditions" block as wrapped text starting at (x, y),
 * page-breaking first if the whole block wouldn't fit on the current page.
 * Returns the Y position after the block, so callers can continue drawing
 * below it if needed.
 */
export function drawTermsAndConditions(doc: jsPDF, x: number, y: number, maxWidth: number): number {
  const headingHeight = 5;
  const lineHeight = 3.6;
  const bodyFontSize = 7.5;

  doc.setFontSize(bodyFontSize);
  doc.setFont("helvetica", "normal");
  const wrappedLines: string[][] = TERMS_AND_CONDITIONS.map((line, index) =>
    doc.splitTextToSize(`${index + 1}. ${line}`, maxWidth)
  );
  const totalLines = wrappedLines.reduce((sum, lines) => sum + lines.length, 0);
  const blockHeight = headingHeight + totalLines * lineHeight + 4;

  let cursorY = y;
  if (cursorY + blockHeight > 280) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(TERMS_AND_CONDITIONS_HEADING, x, cursorY);
  cursorY += headingHeight;

  doc.setFontSize(bodyFontSize);
  doc.setFont("helvetica", "normal");
  for (const lines of wrappedLines) {
    for (const line of lines) {
      doc.text(line, x, cursorY);
      cursorY += lineHeight;
    }
  }

  // Leave the doc's font state back to normal body size for whatever the
  // caller draws next.
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  return cursorY;
}

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

/** Hindi version of ownerDetailLines(), for the Hindi invoice download. */
export function ownerDetailLinesHi(): string[] {
  const { proprietor } = siteConfig;
  return [
    "आप चुनें, हम डिज़ाइन करें",
    `द्वारा: ${proprietor.nameHi ?? proprietor.name}   मोबाइल: ${proprietor.phones.join(", ")}`,
    `इंस्टाग्राम: ${proprietor.instagramHandle}`,
  ];
}
