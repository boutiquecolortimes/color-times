// Renders Hindi (Devanagari) text to PNG images in the browser, for the
// Hindi invoice PDF. jsPDF can't shape Devanagari (conjuncts, matra
// reordering), but the browser's canvas can — so any Hindi text that isn't
// a fixed label (terms & conditions, status, item descriptions, notes) is
// drawn here and placed into the PDF as an image.
//
// The font is bundled under /public/fonts so output looks the same on every
// device, rather than depending on whichever Devanagari font the OS has.
// Latin characters inside Hindi text (product names, phone numbers) fall
// back to the system sans-serif font.

const FAMILY = "InvoiceDevanagari";
const FONT_STACK = `${FAMILY}, "Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", "Mangal", sans-serif`;

// Rendering resolution — 12px per mm is roughly 300 dpi, sharp when printed.
const PX_PER_MM = 12;

let fontPromise: Promise<void> | null = null;

/** Loads the bundled Devanagari font once. Safe to call repeatedly. */
export function loadDevanagariFont(): Promise<void> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const faces = [
        new FontFace(FAMILY, "url(/fonts/noto-sans-devanagari-400.woff2)", { weight: "400" }),
        new FontFace(FAMILY, "url(/fonts/noto-sans-devanagari-700.woff2)", { weight: "700" }),
      ];
      await Promise.all(
        faces.map(async (face) => {
          try {
            await face.load();
            document.fonts.add(face);
          } catch {
            // Fall back to the system's Devanagari font rather than failing
            // the whole download.
          }
        })
      );
    })();
  }
  return fontPromise;
}

export interface TextImage {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  /** Height of one line box, for aligning the first line to a baseline. */
  firstLineMm: number;
}

export interface HindiTextOptions {
  /** Font size in mm (1pt ≈ 0.353mm). */
  fontSizeMm: number;
  /** Wrap onto multiple lines at this width. Omit for a single line. */
  maxWidthMm?: number;
  bold?: boolean;
  /** Multiple of font size between lines. */
  lineHeight?: number;
  color?: string;
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > maxWidthPx) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

/** Draws text (Hindi or mixed) to a transparent PNG sized in mm. */
export function renderHindiText(text: string, options: HindiTextOptions): TextImage {
  const fontPx = options.fontSizeMm * PX_PER_MM;
  const lineHeightPx = fontPx * (options.lineHeight ?? 1.55);
  const font = `${options.bold ? 700 : 400} ${fontPx}px ${FONT_STACK}`;

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas is not available");
  measure.font = font;

  const lines = options.maxWidthMm
    ? wrapWords(measure, text, options.maxWidthMm * PX_PER_MM)
    : [text];
  const widestPx = Math.max(1, ...lines.map((line) => measure.measureText(line).width));

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(widestPx + 2);
  canvas.height = Math.ceil(lines.length * lineHeightPx);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.font = font;
  ctx.fillStyle = options.color ?? "#1b1b1b";
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, index) => {
    // Baseline sits a little below the middle of each line box, leaving
    // room above for matras and below for descending vowel signs.
    ctx.fillText(line, 1, index * lineHeightPx + lineHeightPx * 0.68);
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: canvas.width / PX_PER_MM,
    heightMm: canvas.height / PX_PER_MM,
    firstLineMm: lineHeightPx / PX_PER_MM,
  };
}

/** Hindi wording for invoice statuses. */
export const STATUS_HI: Record<string, string> = {
  draft: "ड्राफ्ट",
  sent: "भेजा गया",
  partially_paid: "आंशिक भुगतान",
  paid: "पूर्ण भुगतान",
  overdue: "बकाया (समय सीमा पार)",
  cancelled: "रद्द",
};

/** Hindi wording for payment methods. */
export const PAYMENT_METHOD_HI: Record<string, string> = {
  cash: "नकद",
  card: "कार्ड",
  upi: "यूपीआई",
  bank_transfer: "बैंक ट्रांसफर",
  other: "अन्य",
};

const RETURN_CONDITION_HI: Record<string, string> = {
  good: "ठीक",
  damaged: "क्षतिग्रस्त",
  minor_damage: "मामूली नुकसान",
  major_damage: "भारी नुकसान",
  missing_items: "सामान गायब",
};

/** Numeric date (dd-mm-yyyy) — avoids English month names on the Hindi PDF. */
export function formatDateHi(value: string | number | Date): string {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

/**
 * Translates the line-item descriptions the system generates itself (see
 * app/api/admin/invoices/from-booking/route.ts). Product names stay as
 * entered; anything typed by hand is left unchanged.
 */
export function translateLineItemHi(description: string): string {
  const rental = description.match(/^Rental \u2014 (.*) \((.*)\), (.+) to (.+)$/);
  if (rental) {
    const [, product, size, from, to] = rental;
    const sizePart = size && size !== "—" ? ` (साइज़ ${size})` : "";
    return `किराया — ${product}${sizePart}, ${toNumericDate(from)} से ${toNumericDate(to)}`;
  }
  const damage = description.match(/^Damage charges \u2014 noted at return \((.*)\)$/);
  if (damage) {
    const condition = damage[1].replace(/ /g, "_");
    return `नुकसान शुल्क — वापसी पर दर्ज (${RETURN_CONDITION_HI[condition] ?? damage[1]})`;
  }
  return description;
}

// "02-Oct-2026" → "02-10-2026"; anything else is returned unchanged.
function toNumericDate(value: string): string {
  const parsed = value.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!parsed) return value;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(parsed[2].toLowerCase());
  return index < 0 ? value : `${parsed[1]}-${String(index + 1).padStart(2, "0")}-${parsed[3]}`;
}

/** True when the text contains Devanagari, which jsPDF can't draw as text. */
export function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}
