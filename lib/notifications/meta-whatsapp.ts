import "server-only";

const GRAPH_API_VERSION = "v21.0";

export function isMetaWhatsAppConfigured(): boolean {
  return Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID);
}

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

interface SendMetaWhatsAppMessageParams {
  to: string;
  templateName: string;
  languageCode: string;
  // Ordered values for the approved template's {{1}}, {{2}}, ... body
  // placeholders — count and order must match exactly what Meta approved
  // (see lib/notifications/trigger-events.ts TRIGGER_EVENT_VARIABLES), or
  // the send is rejected. Omit/empty only for a template with no variables.
  parameters?: string[];
  // Set only when the approved template's first component is a HEADER of
  // format DOCUMENT (bill/invoice/booking-confirmation PDFs). Meta requires
  // this component to be present — with a URL its servers can actually
  // fetch — whenever the template was approved with one; sending the body
  // alone gets the whole message rejected, which is the gap that made
  // templates like sale_bill_sent / customisation_bill_sent fail from the
  // admin panel while a manual Graph API test (with a header attached by
  // hand) went through fine.
  headerDocument?: { link: string; filename?: string };
}

interface SendMetaWhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Sends a pre-approved WhatsApp template message via Meta's Cloud API directly (no BSP middleman). */
export async function sendMetaWhatsAppMessage(
  params: SendMetaWhatsAppMessageParams
): Promise<SendMetaWhatsAppMessageResult> {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return {
      success: false,
      error: "META_WHATSAPP_ACCESS_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID is not configured",
    };
  }

  // Components must be in the same order Meta approved them in: HEADER
  // before BODY. Skipping a component the template doesn't have is fine;
  // skipping one it does have is what gets the send rejected.
  const components: Record<string, unknown>[] = [];

  if (params.headerDocument) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            link: params.headerDocument.link,
            ...(params.headerDocument.filename ? { filename: params.headerDocument.filename } : {}),
          },
        },
      ],
    });
  }

  if (params.parameters && params.parameters.length > 0) {
    components.push({
      type: "body",
      parameters: params.parameters.map((text) => ({ type: "text", text })),
    });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizePhoneNumber(params.to),
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.languageCode },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      }
    );

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Meta's top-level error.message is often a vague generic string (e.g.
      // "An unknown error has occurred.") — log the full error object
      // server-side (code/type/fbtrace_id) so a failure is actually
      // debuggable from Vercel's runtime logs, and surface the error code
      // in the message we hand back since that's usually the real signal
      // (190 = bad/expired token, 100 = bad parameter, 10/200-series =
      // permission issues, 131xxx = messaging-specific failures, 132000 =
      // component/parameter count mismatch — e.g. a header the template
      // needs wasn't sent, 132001 = template name/language not found).
      console.error("Meta WhatsApp API error:", JSON.stringify(json?.error ?? json));
      const metaError = json?.error;
      const baseMessage =
        typeof metaError?.message === "string" ? metaError.message : `Meta API error (${response.status})`;
      const error = metaError?.code
        ? `${baseMessage} (code ${metaError.code}${metaError.error_subcode ? `/${metaError.error_subcode}` : ""})`
        : baseMessage;
      return { success: false, error };
    }

    return { success: true, messageId: json?.messages?.[0]?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reach Meta WhatsApp API",
    };
  }
}
