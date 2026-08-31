import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { siteConfig } from "@/lib/config/site";
import { TERMS_IMAGE_PATH, TERMS_IMAGE_RATIO, ownerDetailLines } from "@/lib/admin/pdf-footer";
import { formatDate } from "@/lib/utils";
import type { CustomisationMeasurements } from "@/models/CustomisationOrder";
import { MEASUREMENT_FIELD_DEFS } from "@/lib/config/measurement-fields";

interface CustomisationPdfData {
  billNumber: string;
  orderDate: Date;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  stitchingType: string;
  detail: string;
  measurements: CustomisationMeasurements;
  totalAmount: number;
  advancePayment: number;
  dueAmount: number;
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

const MEASUREMENT_LABELS: { key: keyof CustomisationMeasurements; label: string }[] =
  MEASUREMENT_FIELD_DEFS;

export async function generateCustomisationPdfBuffer(order: CustomisationPdfData): Promise<Buffer> {
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
  doc.text("CUSTOMISATION BILL", 196, 18, { align: "right" });
  doc.setFontSize(10);
  doc.text(order.billNumber, 196, 24, { align: "right" });
  doc.text(`Order Date: ${formatDate(order.orderDate)}`, 196, 29, { align: "right" });

  doc.setFontSize(10);
  doc.text("Customer:", 14, 46);
  doc.setFontSize(9);
  doc.text(order.customerName, 14, 51);
  doc.text(order.customerPhone, 14, 56);
  doc.text(order.customerAddress, 14, 61);

  autoTable(doc, {
    head: [["Stitching Type", "Detail"]],
    body: [[order.stitchingType, order.detail]],
    startY: 68,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [32, 26, 22] },
  });

  let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const measurementRows = MEASUREMENT_LABELS.filter(({ key }) => order.measurements[key] != null).map(
    ({ key, label }) => [label, String(order.measurements[key])]
  );

  if (measurementRows.length > 0) {
    doc.setFontSize(11);
    doc.text("Measurements (inches)", 14, cursorY);
    autoTable(doc, {
      body: measurementRows,
      startY: cursorY + 4,
      theme: "plain",
      styles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 40 } },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  const summaryLines = [
    ["Total Amount", formatCurrency(order.totalAmount)],
    ["Advance Payment", formatCurrency(order.advancePayment)],
    ["Due Amount", formatCurrency(order.dueAmount)],
  ];

  autoTable(doc, {
    body: summaryLines,
    startY: cursorY,
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: { 0: { halign: "right", cellWidth: 130 }, 1: { halign: "right", cellWidth: 46 } },
    margin: { left: 20 },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (order.notes) {
    doc.setFontSize(9);
    doc.text(`Notes: ${order.notes}`, 14, cursorY);
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
