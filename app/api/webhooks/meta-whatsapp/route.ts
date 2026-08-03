import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { NotificationLog } from "@/models/NotificationLog";

/** Meta's one-time subscription handshake — echoes back hub.challenge once the verify token matches. */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface MetaStatusEntry {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  errors?: { title?: string }[];
}

/** Delivery-status callbacks for messages sent via the Meta Cloud API — updates the matching NotificationLog row. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const statuses: MetaStatusEntry[] = body?.entry?.[0]?.changes?.[0]?.value?.statuses ?? [];

    if (statuses.length > 0) {
      await connectToDatabase();
      await Promise.all(
        statuses.map((status) => {
          if (status.status === "failed") {
            return NotificationLog.updateOne(
              { providerMessageId: status.id },
              { status: "failed", errorMessage: status.errors?.[0]?.title }
            );
          }
          return NotificationLog.updateOne({ providerMessageId: status.id }, { status: "sent" });
        })
      );
    }
  } catch {
    // Meta expects a 200 regardless — errors here must never surface as a webhook failure.
  }

  return NextResponse.json({ received: true });
}
