import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { CustomisationOrder } from "@/models/CustomisationOrder";
import { generateCustomisationPdfBuffer } from "@/lib/admin/customisation-pdf-server";

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

    const order = await CustomisationOrder.findById(id).lean();
    if (!order || order.deletedAt) {
      return new Response("Not found", { status: 404 });
    }

    const buffer = await generateCustomisationPdfBuffer({
      billNumber: order.billNumber,
      orderDate: order.orderDate,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      stitchingType: order.stitchingType,
      detail: order.detail,
      measurements: order.measurements ?? {},
      totalAmount: order.totalAmount,
      advancePayment: order.advancePayment,
      duePaid: order.duePaid ?? 0,
      dueAmount: order.dueAmount,
      notes: order.notes,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${order.billNumber}.pdf"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate customisation bill PDF:", error);
    return new Response("Unable to generate this bill's PDF right now.", { status: 500 });
  }
}
