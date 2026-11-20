import { NextRequest } from "next/server";
import { generateInvoicePdfBuffer } from "@/lib/admin/invoice-pdf-server";
import { loadInvoicePdfData } from "@/lib/admin/invoice-pdf-data";
import { invoicePdfFilename } from "@/lib/admin/invoice-filename";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  try {
    const result = await loadInvoicePdfData(id);
    if (!result.ok) return new Response(result.message, { status: result.status });
    const buffer = await generateInvoicePdfBuffer(result.data);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoicePdfFilename(result.data)}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate invoice PDF:", error);
    return new Response("Unable to generate this invoice's PDF right now.", { status: 500 });
  }
}
