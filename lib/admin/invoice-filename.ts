/**
 * File name for an invoice PDF: CTBoutique(CTB-2026-01006).pdf. Booking
 * invoices use the booking number; other invoices (sale, customisation,
 * manual) use the invoice number. The Hindi copy gets "-hi" on the end.
 * Shared by the browser download, the public PDF route, the Hindi bill page
 * and the WhatsApp document header.
 */
export function invoicePdfFilename(
  invoice: { invoiceNumber: string; bookingNumber?: string | null },
  lang: "en" | "hi" = "en"
): string {
  const ref = (invoice.bookingNumber || invoice.invoiceNumber).replace(/[\\/:*?"<>|]/g, "-");
  return `CTBoutique(${ref})${lang === "hi" ? "-hi" : ""}.pdf`;
}
