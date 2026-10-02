import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { siteConfig } from "@/lib/config/site";
import { getInvoiceDueBreakdown } from "@/lib/admin/invoice-totals";
import {
  INVOICE_STAGE_LABELS_HI,
  invoiceStageLabel,
} from "@/lib/admin/booking-status";
import {
  drawTermsAndConditions,
  ownerDetailLines,
  ownerDetailLinesHi,
  TERMS_AND_CONDITIONS_HEADING_HI,
  TERMS_AND_CONDITIONS_HI,
} from "@/lib/admin/pdf-footer";
import {
  formatDateHi,
  hasDevanagari,
  loadDevanagariFont,
  PAYMENT_METHOD_HI,
  renderHindiText,
  STATUS_HI,
  translateLineItemHi,
  type TextImage,
} from "@/lib/admin/hindi-canvas";
import {
  EN_LABELS,
  loadHindiLabels,
  type HindiLabelMap,
  type LabelKey,
  type PdfLang,
} from "@/lib/admin/pdf-labels";
import { formatDate, isWalkinEmail } from "@/lib/utils";
import type {
  InvoiceLineItem,
  InvoiceStatus,
  PaymentMethod,
} from "@/models/Invoice";

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
  pickupPaid?: number;
  bookingStage?: string;
  source?: string;
  payments: InvoicePdfPayment[];
  notes?: string;
}

function formatCurrency(value: number): string {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

const PAYMENT_METHOD_EN: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

function statusEn(status: InvoiceStatus): string {
  return status.replace(/_/g, " ").toUpperCase();
}

function loadImageAsDataUrl(
  src: string,
): Promise<{ dataUrl: string; ratio: number } | null> {
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
      resolve({
        dataUrl: canvas.toDataURL("image/png"),
        ratio: img.naturalHeight / img.naturalWidth,
      });
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
  colDescription: 3.6,
  colQty: 3.6,
  colUnitPrice: 3.6,
  colAmount: 3.6,
  rowRent: 4.0,
  rowDiscount: 4.0,
  rowTax: 4.0,
  rowSecurityDeposit: 4.0,
  rowTotal: 4.0,
  rowAmountPaid: 4.0,
  rowRentDue: 4.0,
  rowSecurityHeld: 4.0,
  rowAdvancePaid: 4.0,
  rowDuePaid: 4.0,
  rowTotalRent: 4.0,
  rowSecurityPaid: 4.0,
  rowRemainingDue: 4.0,
  paymentHistory: 3.8,
  colDate: 3.4,
  colMethod: 3.4,
  colReference: 3.4,
  notes: 3.0,
};

export async function downloadInvoicePdf(
  invoice: InvoicePdfData,
  lang: PdfLang = "en",
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait" });
  const logo = await loadImageAsDataUrl("/logo-icon.png");
  const hi = lang === "hi" ? await loadHindiLabels() : null;
  if (hi || (invoice.notes && hasDevanagari(invoice.notes)))
    await loadDevanagariFont();
  const fmtDate = hi ? formatDateHi : formatDate;

  // Places a rendered Hindi text image so its first line sits on the jsPDF
  // text baseline `y` — the same anchor doc.text() uses — so it lines up
  // with neighbouring English/number text.
  function placeText(
    img: TextImage,
    x: number,
    y: number,
    align: "left" | "right" = "left",
  ): void {
    const drawX = align === "right" ? x - img.widthMm : x;
    // Baseline is drawn at 68% of the first line box (see hindi-canvas.ts);
    // single-line images are one line box tall, wrapped ones use the line
    // height of their first line, approximated from the font size used.
    const firstLineMm = img.firstLineMm ?? img.heightMm;
    doc.addImage(
      img.dataUrl,
      "PNG",
      drawX,
      y - firstLineMm * 0.68,
      img.widthMm,
      img.heightMm,
    );
  }

  // jsPDF font sizes are in points; Hindi images are sized in mm.
  const ptToMm = (pt: number) => pt * 0.3528;

  // Draws a standalone label (not inside an autoTable cell) at a jsPDF text
  // baseline position — English text, or the equivalent Hindi label image.
  function label(
    key: LabelKey,
    x: number,
    y: number,
    opts?: { align?: "left" | "right" },
  ): void {
    if (!hi) {
      doc.text(
        EN_LABELS[key],
        x,
        y,
        opts?.align ? { align: opts.align } : undefined,
      );
      return;
    }
    const img = hi[key];
    const heightMm = LABEL_HEIGHT_MM[key];
    const widthMm = heightMm / img.ratio;
    const align = opts?.align ?? "left";
    const drawX = align === "right" ? x - widthMm : x;
    doc.addImage(
      img.dataUrl,
      "PNG",
      drawX,
      y - heightMm * 0.8,
      widthMm,
      heightMm,
    );
  }

  // Draws a right-aligned "value" (a date, a status word) preceded by its
  // label, ending at xRight — used for the Issued/Due/Status lines, where
  // English keeps its original single-string rendering and Hindi splits the
  // label into an image ahead of the value text.
  function labelValue(
    key: LabelKey,
    value: string,
    xRight: number,
    y: number,
  ): void {
    if (!hi) {
      doc.text(`${EN_LABELS[key]} ${value}`, xRight, y, { align: "right" });
      return;
    }
    doc.text(value, xRight, y, { align: "right" });
    const valueWidth = doc.getTextWidth(value);
    const img = hi[key];
    const heightMm = LABEL_HEIGHT_MM[key];
    const widthMm = heightMm / img.ratio;
    doc.addImage(
      img.dataUrl,
      "PNG",
      xRight - valueWidth - 2 - widthMm,
      y - heightMm * 0.8,
      widthMm,
      heightMm,
    );
  }

  // Draws an image centered vertically inside an autoTable cell, aligned to
  // its left or right edge — used to replace table header/label text with
  // the Hindi label image via autoTable's didDrawCell hook.
  function drawCellLabel(
    hiLabels: HindiLabelMap,
    key: LabelKey,
    cell: CellHookData["cell"],
    align: "left" | "right",
  ): void {
    const img = hiLabels[key];
    const heightMm = Math.min(LABEL_HEIGHT_MM[key], cell.height * 0.75);
    const widthMm = heightMm / img.ratio;
    const pad = cell.padding(align);
    const x =
      align === "right" ? cell.x + cell.width - pad - widthMm : cell.x + pad;
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

  if (hi) {
    placeText(
      renderHindiText(siteConfig.nameHi, {
        fontSizeMm: ptToMm(16),
        bold: true,
        lineHeight: 1.3,
      }),
      textStartX,
      19,
    );
    placeText(
      renderHindiText(siteConfig.contact.addressHi, {
        fontSizeMm: ptToMm(9),
        lineHeight: 1.3,
      }),
      textStartX,
      25,
    );
  } else {
    doc.setFontSize(16);
    doc.text(siteConfig.name, textStartX, 19);
    doc.setFontSize(9);
    doc.text(siteConfig.contact.address, textStartX, 25);
  }
  doc.setFontSize(9);
  doc.text(
    `${siteConfig.contact.email} · ${siteConfig.contact.phone}`,
    textStartX,
    30,
  );
  doc.setFontSize(8);
  (hi ? ownerDetailLinesHi() : ownerDetailLines()).forEach((line, index) => {
    if (hi) {
      placeText(
        renderHindiText(line, { fontSizeMm: ptToMm(8), lineHeight: 1.3 }),
        textStartX,
        34 + index * 4,
      );
    } else {
      doc.text(line, textStartX, 34 + index * 4);
    }
  });

  doc.setFontSize(16);
  label("invoiceTitle", 196, 18, { align: "right" });
  doc.setFontSize(10);
  doc.text(invoice.invoiceNumber, 196, 24, { align: "right" });
  labelValue("issued", fmtDate(invoice.createdAt), 196, 29);
  labelValue("due", fmtDate(invoice.dueDate), 196, 34);
  if (hi) {
    const statusImg = renderHindiText(
      STATUS_HI[invoice.status] ?? invoice.status,
      {
        fontSizeMm: ptToMm(10),
        lineHeight: 1.3,
      },
    );
    placeText(statusImg, 196, 39, "right");
    const img = hi.status;
    const heightMm = LABEL_HEIGHT_MM.status;
    const widthMm = heightMm / img.ratio;
    doc.addImage(
      img.dataUrl,
      "PNG",
      196 - statusImg.widthMm - 2 - widthMm,
      39 - heightMm * 0.8,
      widthMm,
      heightMm,
    );
  } else {
    labelValue("status", statusEn(invoice.status), 196, 39);
  }

  // Why this invoice exists — the booking stage it was generated/updated at.
  if (invoice.bookingStage) {
    if (hi) {
      const stageHi =
        INVOICE_STAGE_LABELS_HI[invoice.bookingStage] ?? invoice.bookingStage;
      placeText(
        renderHindiText(`बिल का कारण: ${stageHi}`, {
          fontSizeMm: ptToMm(10),
          lineHeight: 1.3,
        }),
        196,
        44,
        "right",
      );
    } else if (invoiceStageLabel(invoice.bookingStage)) {
      doc.setFontSize(10);
      doc.text(
        `Generated At: ${invoiceStageLabel(invoice.bookingStage)}`,
        196,
        44,
        { align: "right" },
      );
    }
  }

  // Walk-in customers get a generated placeholder email just to satisfy the
  // account system's unique/required email field (e.g.
  // "98765xxxxx.<timestamp>@walkin.vchuki.local") — never something a
  // customer should see printed on their own bill, so it's skipped here in
  // favor of their phone number.
  doc.setFontSize(10);
  label("billTo", 14, 46);
  doc.setFontSize(9);
  doc.text(invoice.customer.name, 14, 51);
  const showEmail =
    Boolean(invoice.customer.email) && !isWalkinEmail(invoice.customer.email);
  if (showEmail) doc.text(invoice.customer.email, 14, 56);
  if (invoice.customer.phone)
    doc.text(invoice.customer.phone, 14, showEmail ? 61 : 56);

  const lineItemHeadKeys: LabelKey[] = [
    "colDescription",
    "colQty",
    "colUnitPrice",
    "colAmount",
  ];
  // Hindi descriptions are pre-rendered at a fixed column width so each row
  // can be made tall enough for its (possibly wrapped) image.
  const DESCRIPTION_WIDTH_MM = 96;
  const descriptionImages = hi
    ? invoice.lineItems.map((item) =>
        renderHindiText(translateLineItemHi(item.description), {
          fontSizeMm: ptToMm(9),
          maxWidthMm: DESCRIPTION_WIDTH_MM - 4,
          lineHeight: 1.4,
        }),
      )
    : [];
  autoTable(doc, {
    head: [
      [
        EN_LABELS.colDescription,
        EN_LABELS.colQty,
        EN_LABELS.colUnitPrice,
        EN_LABELS.colAmount,
      ],
    ],
    body: invoice.lineItems.map((item) => [
      item.description,
      String(item.quantity),
      formatCurrency(item.unitPrice),
      formatCurrency(item.amount),
    ]),
    startY: 68,
    styles: { fontSize: 9 },
    headStyles: {
      fillColor: [32, 26, 22],
      textColor: hi ? [32, 26, 22] : [255, 255, 255],
    },
    columnStyles: hi ? { 0: { cellWidth: DESCRIPTION_WIDTH_MM } } : undefined,
    didParseCell: (data) => {
      if (hi && data.section === "body" && data.column.index === 0) {
        const img = descriptionImages[data.row.index];
        data.cell.text = [""];
        if (img) data.cell.styles.minCellHeight = img.heightMm + 2;
      }
    },
    didDrawCell: (data) => {
      if (hi && data.section === "head") {
        drawCellLabel(
          hi,
          lineItemHeadKeys[data.column.index],
          data.cell,
          "left",
        );
      }
      if (hi && data.section === "body" && data.column.index === 0) {
        const img = descriptionImages[data.row.index];
        if (img) {
          doc.addImage(
            img.dataUrl,
            "PNG",
            data.cell.x + data.cell.padding("left"),
            data.cell.y + (data.cell.height - img.heightMm) / 2,
            img.widthMm,
            img.heightMm,
          );
        }
      }
    },
  });

  const afterLineItemsY = (
    doc as unknown as { lastAutoTable: { finalY: number } }
  ).lastAutoTable.finalY;

  // Security deposits are usually collected and held separately from what
  // gets logged as an invoice payment, so "Amount Due" alone reads as if
  // the deposit is still owed even once it's in hand. Split it out.
  const due = getInvoiceDueBreakdown(invoice);
  // Sale / Customisation bills have no rent, tax or security deposit —
  // just Advance Paid, Due Paid, Total and Remaining Due.
  const isOrderBill =
    invoice.source === "sale" || invoice.source === "customisation";
  const summaryRows: { key: LabelKey; value: string }[] = isOrderBill
    ? [
        { key: "rowAdvancePaid", value: formatCurrency(due.advancePaid) },
        { key: "rowDuePaid", value: formatCurrency(due.duePaid) },
        { key: "rowTotal", value: formatCurrency(invoice.total) },
        { key: "rowRemainingDue", value: formatCurrency(invoice.amountDue) },
      ]
    : [
        { key: "rowRent", value: formatCurrency(invoice.subtotal) },
        {
          key: "rowDiscount",
          value: `-${formatCurrency(invoice.discountAmount)}`,
        },
        {
          key: "rowTax",
          value: `${formatCurrency(invoice.taxAmount)} (${invoice.taxRate}%)`,
        },
        { key: "rowAdvancePaid", value: formatCurrency(due.advancePaid) },
        { key: "rowDuePaid", value: formatCurrency(due.duePaid) },
        { key: "rowTotalRent", value: formatCurrency(due.rentTotal) },
        {
          key: "rowSecurityPaid",
          value: formatCurrency(invoice.securityDeposit),
        },
        { key: "rowRemainingDue", value: formatCurrency(due.rentDue) },
      ];

  autoTable(doc, {
    body: summaryRows.map((row) => [EN_LABELS[row.key], row.value]),
    startY: afterLineItemsY + 6,
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: {
      0: { halign: "right", cellWidth: 130 },
      1: { halign: "right", cellWidth: 46 },
    },
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

  let cursorY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 8;

  if (invoice.payments.length > 0) {
    doc.setFontSize(11);
    label("paymentHistory", 14, cursorY);
    const paymentHeadKeys: LabelKey[] = [
      "colDate",
      "colMethod",
      "colAmount",
      "colReference",
    ];
    autoTable(doc, {
      head: [
        [
          EN_LABELS.colDate,
          EN_LABELS.colMethod,
          EN_LABELS.colAmount,
          EN_LABELS.colReference,
        ],
      ],
      body: invoice.payments.map((payment) => [
        fmtDate(payment.paidAt),
        hi ? "" : (PAYMENT_METHOD_EN[payment.method] ?? payment.method),
        formatCurrency(payment.amount),
        payment.reference ?? "—",
      ]),
      startY: cursorY + 4,
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [32, 26, 22],
        textColor: hi ? [32, 26, 22] : [255, 255, 255],
      },
      didDrawCell: (data) => {
        if (hi && data.section === "head") {
          drawCellLabel(
            hi,
            paymentHeadKeys[data.column.index],
            data.cell,
            "left",
          );
        }
        if (hi && data.section === "body" && data.column.index === 1) {
          const method = invoice.payments[data.row.index]?.method;
          const img = renderHindiText(PAYMENT_METHOD_HI[method] ?? method, {
            fontSizeMm: ptToMm(8),
            lineHeight: 1.3,
          });
          const heightMm = Math.min(img.heightMm, data.cell.height * 0.8);
          const widthMm = img.widthMm * (heightMm / img.heightMm);
          doc.addImage(
            img.dataUrl,
            "PNG",
            data.cell.x + data.cell.padding("left"),
            data.cell.y + (data.cell.height - heightMm) / 2,
            widthMm,
            heightMm,
          );
        }
      },
    });
    cursorY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;
  }

  if (invoice.notes) {
    doc.setFontSize(9);
    if (!hi && hasDevanagari(invoice.notes)) {
      // Notes typed in Hindi on an English download — still drawn through
      // the canvas so they don't come out as garbled characters.
      doc.text("Notes:", 14, cursorY);
      const notesImg = renderHindiText(invoice.notes, {
        fontSizeMm: ptToMm(9),
        maxWidthMm: 182 - 12,
        lineHeight: 1.4,
      });
      placeText(notesImg, 26, cursorY);
      cursorY += Math.max(0, notesImg.heightMm - 5);
    } else if (!hi) {
      doc.text(`Notes: ${invoice.notes}`, 14, cursorY);
    } else {
      label("notes", 14, cursorY);
      const img = hi.notes;
      const heightMm = LABEL_HEIGHT_MM.notes;
      const widthMm = heightMm / img.ratio;
      // Rendered through the canvas too, so notes typed in Hindi come out
      // correctly shaped instead of as broken glyphs.
      const notesImg = renderHindiText(invoice.notes, {
        fontSizeMm: ptToMm(9),
        maxWidthMm: 182 - widthMm - 2,
        lineHeight: 1.4,
      });
      placeText(notesImg, 14 + widthMm + 2, cursorY);
      cursorY += Math.max(0, notesImg.heightMm - 5);
    }
    cursorY += 8;
  }

  // Terms & Conditions follow the download language: English as real text,
  // Hindi through the canvas renderer (jsPDF can't shape Devanagari).
  if (hi) {
    drawHindiTerms(cursorY);
  } else {
    drawTermsAndConditions(doc, 14, cursorY, 182);
  }

  doc.save(`${invoice.invoiceNumber}${lang === "hi" ? "-hi" : ""}.pdf`);

  function drawHindiTerms(startY: number): void {
    const heading = renderHindiText(TERMS_AND_CONDITIONS_HEADING_HI, {
      fontSizeMm: ptToMm(10),
      bold: true,
      lineHeight: 1.4,
    });
    const items = TERMS_AND_CONDITIONS_HI.map((line, index) =>
      renderHindiText(`${index + 1}. ${line}`, {
        fontSizeMm: ptToMm(8),
        maxWidthMm: 182,
        lineHeight: 1.5,
      }),
    );
    const blockHeight =
      heading.heightMm + items.reduce((sum, img) => sum + img.heightMm, 0) + 2;
    let y = startY - 3;
    if (y + blockHeight > 285) {
      doc.addPage();
      y = 15;
    }
    doc.addImage(
      heading.dataUrl,
      "PNG",
      14,
      y,
      heading.widthMm,
      heading.heightMm,
    );
    y += heading.heightMm;
    for (const img of items) {
      doc.addImage(img.dataUrl, "PNG", 14, y, img.widthMm, img.heightMm);
      y += img.heightMm;
    }
  }
}
