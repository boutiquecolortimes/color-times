import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Sale } from "@/models/Sale";
import "@/models/Product";
import { generateSalePdfBuffer } from "@/lib/admin/sale-pdf-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await connectToDatabase();

    const sale = await Sale.findById(id).populate("product", "name sku").lean();
    if (!sale || sale.deletedAt) {
      return new Response("Not found", { status: 404 });
    }

    const product = sale.product as unknown as { name: string; sku: string } | null;

    const buffer = await generateSalePdfBuffer({
      billNumber: sale.billNumber,
      saleDate: sale.saleDate,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      customerAddress: sale.customerAddress,
      productName: product?.name ?? "—",
      productSku: product?.sku ?? "",
      details: sale.details,
      totalAmount: sale.totalAmount,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${sale.billNumber}.pdf"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate sale bill PDF:", error);
    return new Response("Unable to generate this bill's PDF right now.", { status: 500 });
  }
}
