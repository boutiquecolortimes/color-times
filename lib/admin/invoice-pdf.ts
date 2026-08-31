import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { siteConfig } from "@/lib/config/site";
import { getInvoiceDueBreakdown } from "@/lib/admin/invoice-totals";
import { TERMS_IMAGE_PATH, ownerDetailLines } from "@/lib/admin/pdf-footer";
import { EN_LABELS, loadHindiLabels, type HindiLabelMap, type LabelKey, type PdfLang } from "@/lib/admin/pdf-labels";
import { formatDate } from "@/lib/utils";
import type { InvoiceLineItem, InvoiceStatus, PaymentMethod } from "@/models/Invoice";

interface InvoicePdfPayment {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
}

interface InvoicePdfData {
  invoiceNumber: string;
  status: InvoiceStatus;
  createdAt: string;
  dueDate: string;
  customer: { name: string; email: string; phone?: string };
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  securityDeposit: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  payments: InvoicePdfPayment[];
  notes?: string;
}

function formatCurrency(value: number): string {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function loadImageAsDataUrl(src: string): Promise<{ dataUrl: string; ratio: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL("image/png"), ratio: img.naturalHeight / img.naturalWidth });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Target print height (mm) for each Hindi label image — tuned to sit
// visually level with the Latin text/font sizes used alongside it.
const LABEL_HEIGHT_MM: Record<LabelKey, number> = {
  invoiceTitle: 5.6,
  issued: 3.3,
  due: 3.3,
  status: 3.3,
  billTo: 3.6,
  colDescription: 3.0,
  colQty: 3.0,
  colUnitPrice: 3.0,
  colAmount: 3.0,
  rowRent: 3.0,
  rowDiscount: 3.0,
  rowTax: 3.0,
  rowSecurityDeposit: 3.0,
  rowTotal: 3.0,
  rowAmountPaid: 3.0,
  rowRentDue: 3.0,
  rowSecurityHeld: 3.0,
  paymentHistory: 3.8,
  colDate: 2.7,
  colMethod: 2.7,
  colReference: 2.7,
  notes: 3.0,
};

export async function downloadInvoicePdf(invoice: InvoicePdfData, lang: PdfLang = "en"): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait" });
  const logo = await loadImageAsDataUrl("/logo-icon.png");
  const hi = lang === "hi" ? await loadHindiLabels() : null;

  // Draws a standalone label (not inside an autoTable cell) at a jsPDF text
  // baseline position — English text, or the equivalent Hindi label image.
  function label(
    key: LabelKey,
    x: number,
    y: number,
    opts?: { align?: "left" | "right" }
  ): void {
    if (!hi) {
      doc.text(EN_LABELS[key], x, y, opts?.align ? { align: opts.align } : undefined);
      return;
    }
    const img = hi[key];
    const heightMm = LABEL_HEIGHT_MM[key];
    const widthMm = heightMm / img.ratio;
    const align = opts?.align ?? "left";
    const drawX = align === "right" ? x - widthMm : x;
    doc.addImage(img.dataUrl, "PNG", drawX, y - heightMm * 0.8, widthMm, heightMm);
  }

  // Draws a right-aligned "value" (a date, a status word) preceded by its
  // label, ending at xRight — used for the Issued/Due/Status lines, where
  // English keeps its original single-string rendering and Hindi splits the
  // label into an image ahead of the value text.
  function labelValue(key: LabelKey, value: string, xRight: number, y: number): void {
    if (!hi) {
      doc.text(`${EN_LABELS[key]} ${value}`, xRight, y, { align: "right" });
      return;
    }
    doc.text(value, xRight, y, { align: "right" });
    const valueWidth = doc.getTextWidth(value);
    const img = hi[key];
    const heightMm = LABEL_HEIGHT_MM[key];
    const widthMm = heightMm / img.ratio;
    doc.addImage(img.dataUrl, "PNG", xRight - valueWidth - 2 - widthMm, y - heightMm * 0.8, widthMm, heightMm);
  }

  // Draws an image centered vertically inside an autoTable cell, aligned to
  // its left or right edge — used to replace table header/label text with
  // the Hindi label image via autoTable's didDrawCell hook.
  function drawCellLabel(hiLabels: HindiLabelMap, key: LabelKey, cell: CellHookData["cell"], align: "left" | "right"): void {
    const img = hiLabels[key];
    const heightMm = Math.min(LABEL_HEIGHT_MM[key], cell.height * 0.6);
    const widthMm = heightMm / img.ratio;
    const pad = cell.padding(align);
    const x = align === "right" ? cell.x + cell.width - pad - widthMm : cell.x + pad;
    const y = cell.y + (cell.height - heightMm) / 2;
    doc.addImage(img.dataUrl, "PNG", x, y, widthMm, heightMm);
  }

  let textStartX = 14;
  if (logo) {
    const logoWidth = 16;
    const logoHeight = logoWidth * logo.ratio;
    doc.addImage(logo.dataUrl, "PNG", 14, 12, logoWidth, logoHeight);
    textStartX = 14 + logoWidth + 4;
  }

  doc.setFontSize(16);
  doc.text(siteConfig.name, textStartX, 19);
  doc.setFontSize(9);
  doc.text(siteConfig.contact.address, textStartX, 25);
  doc.text(`${siteConfig.contact.email} · ${siteConfig.contact.phone}`, textStartX, 30);
  doc.setFontSize(8);
  ownerDetailLines().forEach((line, index) => {
    doc.text(line, textStartX, 34 + index * 4);
  });

  doc.setFontSize(16);
  label("invoiceTitle", 196, 18, { align: "right" });
  doc.setFontSize(10);
  doc.text(invoice.invoiceNumber, 196, 24, { align: "right" });
  labelValue("issued", formatDate(invoice.createdAt), 196, 29);
  labelValue("due", formatDate(invoice.dueDate), 196, 34);
  labelValue("status", invoice.status.replace("_", " ").toUpperCase(), 196, 39);

  doc.setFontSize(10);
  label("billTo", 14, 46);
  doc.setFontSize(9);
  doc.text(invoice.customer.name, 14, 51);
  doc.text(invoice.customer.email, 14, 56);
  if (invoice.customer.phone) doc.text(invoice.customer.phone, 14, 61);

  const lineItemHeadKeys: LabelKey[] = ["colDescription", "colQty", "colUnitPrice", "colAmount"];
  autoTable(doc, {
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: invoice.lineItems.map((item) => [
      item.description,
      String(item.quantity),
      formatCurrency(item.unitPrice),
      formatCurrency(item.amount),
    ]),
    startY: 68,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [32, 26, 22], textColor: hi ? [32, 26, 22] : undefined },
    didDrawCell: (data) => {
      if (hi && data.section === "head") {
        drawCellLabel(hi, lineItemHeadKeys[data.column.index], data.cell, "left");
      }
    },
  });

  const afterLineItemsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;

  // Security deposits are usually collected and held separately from what
  // gets logged as an invoice payment, so "Amount Due" alone reads as if
  // the deposit is still owed even once it's in hand. Split it out.
  const due = getInvoiceDueBreakdown(invoice);
  const summaryRows: { key: LabelKey; value: string }[] = [
    { key: "rowRent", value: formatCurrency(invoice.subtotal) },
    { key: "rowDiscount", value: `-${formatCurrency(invoice.discountAmount)}` },
    { key: "rowTax", value: `${formatCurrency(invoice.taxAmount)} (${invoice.taxRate}%)` },
    { key: "rowSecurityDeposit", value: formatCurrency(invoice.securityDeposit) },
    { key: "rowTotal", value: formatCurrency(invoice.total) },
    { key: "rowAmountPaid", value: formatCurrency(invoice.amountPaid) },
    { key: "rowRentDue", value: formatCurrency(due.rentDue) },
    ...(due.securityHeld > 0
      ? [{ key: "rowSecurityHeld" as LabelKey, value: formatCurrency(due.securityHeld) }]
      : []),
  ];

  autoTable(doc, {
    body: summaryRows.map((row) => [EN_LABELS[row.key], row.value]),
    startY: afterLineItemsY + 6,
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: { 0: { halign: "right", cellWidth: 130 }, 1: { halign: "right", cellWidth: 46 } },
    margin: { left: 20 },
    didParseCell: (data) => {
      // Hide the English text jsPDF would otherwise draw for this cell —
      // the Hindi label image goes on top of it in didDrawCell below, and
      // this table has no cell background (theme "plain"), so matching the
      // page's white is what makes the English text disappear underneath.
      if (hi && data.section === "body" && data.column.index === 0) {
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
    didDrawCell: (data) => {
      if (hi && data.section === "body" && data.column.index === 0) {
        drawCellLabel(hi, summaryRows[data.row.index].key, data.cell, "right");
      }
    },
  });

  let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (invoice.payments.length > 0) {
    doc.setFontSize(11);
    label("paymentHistory", 14, cursorY);
    const paymentHeadKeys: LabelKey[] = ["colDate", "colMethod", "colAmount", "colReference"];
    autoTable(doc, {
      head: [["Date", "Method", "Amount", "Reference"]],
      body: invoice.payments.map((payment) => [
        formatDate(payment.paidAt),
        payment.method.replace("_", " "),
        formatCurrency(payment.amount),
        payment.reference ?? "—",
      ]),
      startY: cursorY + 4,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [32, 26, 22], textColor: hi ? [32, 26, 22] : undefined },
      didDrawCell: (data) => {
        if (hi && data.section === "head") {
          drawCellLabel(hi, paymentHeadKeys[data.column.index], data.cell, "left");
        }
      },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (invoice.notes) {
    doc.setFontSize(9);
    if (!hi) {
      doc.text(`Notes: ${invoice.notes}`, 14, cursorY);
    } else {
      label("notes", 14, cursorY);
      const img = hi.notes;
      const heightMm = LABEL_HEIGHT_MM.notes;
      const widthMm = heightMm / img.ratio;
      doc.text(invoice.notes, 14 + widthMm + 2, cursorY);
    }
    cursorY += 8;
  }

  const terms = await loadImageAsDataUrl(TERMS_IMAGE_PATH);
  if (terms) {
    const termsWidth = 182;
    const termsHeight = termsWidth * terms.ratio;
    if (cursorY + termsHeight > 280) {
      doc.addPage();
      cursorY = 20;
    }
    doc.addImage(terms.dataUrl, "PNG", 14, cursorY, termsWidth, termsHeight);
  }

  doc.save(`${invoice.invoiceNumber}${lang === "hi" ? "-hi" : ""}.pdf`);
}
