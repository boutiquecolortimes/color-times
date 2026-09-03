import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { siteConfig } from "@/lib/config/site";
import { getInvoiceDueBreakdown } from "@/lib/admin/invoice-totals";
import { TERMS_IMAGE_PATH, TERMS_IMAGE_RATIO, ownerDetailLines } from "@/lib/admin/pdf-footer";
import { formatDate, isWalkinEmail } from "@/lib/utils";
import type { InvoiceLineItem, InvoiceStatus, PaymentMethod } from "@/models/Invoice";

interface InvoicePdfPayment {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt: Date;
}

interface InvoicePdfData {
  invoiceNumber: string;
  status: InvoiceStatus;
  createdAt: Date;
  dueDate: Date;
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

async function loadLogoDataUrl(): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "logo-icon.png");
    const buffer = await readFile(filePath);
    return { dataUrl: `data:image/png;base64,${buffer.toString("base64")}`, ratio: 1 };
  } catch {
    return null;
  }
}

async function loadTermsImageDataUrl(): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), "public", TERMS_IMAGE_PATH);
    const buffer = await readFile(filePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function generateInvoicePdfBuffer(invoice: InvoicePdfData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait" });
  const logo = await loadLogoDataUrl();

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
  doc.text("INVOICE", 196, 18, { align: "right" });
  doc.setFontSize(10);
  doc.text(invoice.invoiceNumber, 196, 24, { align: "right" });
  doc.text(`Issued: ${formatDate(invoice.createdAt)}`, 196, 29, { align: "right" });
  doc.text(`Due: ${formatDate(invoice.dueDate)}`, 196, 34, { align: "right" });
  doc.text(`Status: ${invoice.status.replace("_", " ").toUpperCase()}`, 196, 39, { align: "right" });

  // Walk-in customers get a generated placeholder email just to satisfy the
  // account system's unique/required email field (e.g.
  // "98765xxxxx.<timestamp>@walkin.vchuki.local") — never something a
  // customer should see printed on their own bill, so it's skipped here in
  // favor of their phone number.
  doc.setFontSize(10);
  doc.text("Bill To:", 14, 46);
  doc.setFontSize(9);
  doc.text(invoice.customer.name, 14, 51);
  const showEmail = !isWalkinEmail(invoice.customer.email);
  if (showEmail) doc.text(invoice.customer.email, 14, 56);
  if (invoice.customer.phone) doc.text(invoice.customer.phone, 14, showEmail ? 61 : 56);

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
    headStyles: { fillColor: [32, 26, 22] },
  });

  const afterLineItemsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;

  // Security deposits are usually collected and held separately from what
  // gets logged as an invoice payment, so "Amount Due" alone reads as if
  // the deposit is still owed even once it's in hand. Split it out.
  const due = getInvoiceDueBreakdown(invoice);
  const summaryLines = [
    ["Rent", formatCurrency(invoice.subtotal)],
    ["Discount", `-${formatCurrency(invoice.discountAmount)}`],
    [`Tax (${invoice.taxRate}%)`, formatCurrency(invoice.taxAmount)],
    ["Security Deposit", formatCurrency(invoice.securityDeposit)],
    ["Total", formatCurrency(invoice.total)],
    ["Amount Paid", formatCurrency(invoice.amountPaid)],
    ["Rent Due", formatCurrency(due.rentDue)],
    ...(due.securityHeld > 0 ? [["Security Held", formatCurrency(due.securityHeld)]] : []),
  ];

  autoTable(doc, {
    body: summaryLines,
    startY: afterLineItemsY + 6,
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: { 0: { halign: "right", cellWidth: 130 }, 1: { halign: "right", cellWidth: 46 } },
    margin: { left: 20 },
  });

  let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (invoice.payments.length > 0) {
    doc.setFontSize(11);
    doc.text("Payment History", 14, cursorY);
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
      headStyles: { fillColor: [32, 26, 22] },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (invoice.notes) {
    doc.setFontSize(9);
    doc.text(`Notes: ${invoice.notes}`, 14, cursorY);
    cursorY += 8;
  }

  const termsDataUrl = await loadTermsImageDataUrl();
  if (termsDataUrl) {
    const termsWidth = 182;
    const termsHeight = termsWidth * TERMS_IMAGE_RATIO;
    if (cursorY + termsHeight > 280) {
      doc.addPage();
      cursorY = 20;
    }
    doc.addImage(termsDataUrl, "PNG", 14, cursorY, termsWidth, termsHeight);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
