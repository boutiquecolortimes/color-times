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
            ...(params.parameters && params.parameters.length > 0
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: params.parameters.map((text) => ({ type: "text", text })),
                    },
                  ],
                }
              : {}),
          },
        }),
      }
    );

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error =
        typeof json?.error?.message === "string" ? json.error.message : `Meta API error (${response.status})`;
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
