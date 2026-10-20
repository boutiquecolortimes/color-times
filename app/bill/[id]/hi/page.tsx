import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadInvoicePdfData } from "@/lib/admin/invoice-pdf-data";
import { HindiBill } from "@/components/bill/hindi-bill";

export const metadata: Metadata = {
  title: "बिल (Hindi bill)",
  robots: { index: false, follow: false },
};

/**
 * Hindi copy of an invoice. Hindi text has to be shaped by the browser's
 * canvas (jsPDF can't), so the PDF is built here on the client — the mobile
 * app opens this page for "हिंदी PDF". Same exposure as the public English
 * PDF link (/api/invoices/[id]/pdf): reachable only with the invoice id.
 */
export default async function HindiBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadInvoicePdfData(id);
  if (!result.ok) notFound();
  // Plain JSON for the client component (dates → ISO strings, ObjectIds → strings).
  const data = JSON.parse(JSON.stringify(result.data));
  return <HindiBill invoice={data} />;
}
