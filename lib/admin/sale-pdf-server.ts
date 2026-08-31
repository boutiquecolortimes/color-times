import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { siteConfig } from "@/lib/config/site";
import { TERMS_IMAGE_PATH, TERMS_IMAGE_RATIO, ownerDetailLines } from "@/lib/admin/pdf-footer";
import { formatDate } from "@/lib/utils";

interface SalePdfData {
  billNumber: string;
  saleDate: Date;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  productSku: string;
  details?: string;
  totalAmount: number;
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

export async function generateSalePdfBuffer(sale: SalePdfData): Promise<Buffer> {
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
  doc.text("SALE BILL", 196, 18, { align: "right" });
  doc.setFontSize(10);
  doc.text(sale.billNumber, 196, 24, { align: "right" });
  doc.text(`Date: ${formatDate(sale.saleDate)}`, 196, 29, { align: "right" });

  doc.setFontSize(10);
  doc.text("Customer:", 14, 46);
  doc.setFontSize(9);
  doc.text(sale.customerName, 14, 51);
  doc.text(sale.customerPhone, 14, 56);
  doc.text(sale.customerAddress, 14, 61);

  autoTable(doc, {
    head: [["Dress Code", "Dress Name", "Details", "Amount"]],
    body: [[sale.productSku, sale.productName, sale.details ?? "—", formatCurrency(sale.totalAmount)]],
    startY: 68,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [32, 26, 22] },
  });

  const afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    body: [["Total Amount", formatCurrency(sale.totalAmount)]],
    startY: afterTableY + 6,
    theme: "plain",
    styles: { fontSize: 10, fontStyle: "bold" },
    columnStyles: { 0: { halign: "right", cellWidth: 130 }, 1: { halign: "right", cellWidth: 46 } },
    margin: { left: 20 },
  });

  let cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

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
