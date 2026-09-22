import type { jsPDF } from "jspdf";
import { siteConfig } from "@/lib/config/site";

// English terms & conditions text, matched to the boutique's printed Hindi
// booking slip. Drawn as real jsPDF text rather than a pre-rendered image —
// jsPDF's built-in fonts render Latin text fine (it's Devanagari glyph
// shaping it can't do), so there's no reason to pay the image-rendering
// complexity/risk here. This also fixes the bug where every generated
// bill/invoice/PDF carried this block in Hindi regardless of the rest of
// the document being in English — real text can't silently drift into the
// wrong language the way a hardcoded image could.
//
// NOTE: line 5 below is a best-effort reading of the printed slip — that
// part of the photo was partly covered by a thumb. Confirm the exact
// wording and I'll adjust it (now a one-line text edit, not a re-rendered
// image).
export const TERMS_AND_CONDITIONS: string[] = [
  "Booking is confirmed 100% only once the advance amount has been paid.",
  "A booked dress cannot be cancelled. If cancelled, the advance amount already paid will not be refunded.",
  "The date of a booked dress cannot be changed once booked.",
  "If the dress is returned late, or is found stained or torn, extra charges will be deducted from the security deposit.",
  "The full security deposit must be paid before the dress is taken away.",
  "Please check the dress's condition, stitching and fitting carefully before taking it — report any issue before it leaves the store.",
  "All disputes are subject to the jurisdiction of Phalodi.",
];

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
  doc.text("Terms & Conditions", x, cursorY);
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
