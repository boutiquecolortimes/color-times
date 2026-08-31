// English labels used when generating invoice PDFs, plus the machinery for
// swapping in the Hindi variant. jsPDF's built-in fonts only support Latin
// text — even with a Devanagari font embedded, jsPDF doesn't perform the
// glyph shaping (conjunct formation, matra reordering) that Hindi needs, so
// typing Hindi labels directly renders them wrong. Instead each Hindi label
// is a small pre-rendered image (correctly shaped by a real browser once,
// offline) — see lib/admin/pdf-hindi-labels.json.

export const EN_LABELS = {
  invoiceTitle: "INVOICE",
  issued: "Issued:",
  due: "Due:",
  status: "Status:",
  billTo: "Bill To:",
  colDescription: "Description",
  colQty: "Qty",
  colUnitPrice: "Unit Price",
  colAmount: "Amount",
  rowRent: "Rent",
  rowDiscount: "Discount",
  rowTax: "Tax",
  rowSecurityDeposit: "Security Deposit",
  rowTotal: "Total",
  rowAmountPaid: "Amount Paid",
  rowRentDue: "Rent Due",
  rowSecurityHeld: "Security Held",
  paymentHistory: "Payment History",
  colDate: "Date",
  colMethod: "Method",
  colReference: "Reference",
  notes: "Notes:",
} as const;

export type LabelKey = keyof typeof EN_LABELS;

export type PdfLang = "en" | "hi";

export interface HindiLabelImage {
  /** PNG data URL, transparent background. */
  dataUrl: string;
  /** height / width of the source image, for scaling without distortion. */
  ratio: number;
}

export type HindiLabelMap = Record<LabelKey, HindiLabelImage>;

/** Lazily loads the Hindi label images so English-only downloads (the
 * common case) don't pay for this ~180KB of embedded image data. */
export async function loadHindiLabels(): Promise<HindiLabelMap> {
  const mod = await import("./pdf-hindi-labels.json");
  return (mod as unknown as { default: HindiLabelMap }).default;
}
