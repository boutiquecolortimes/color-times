import "server-only";
import crypto from "crypto";
import {
  GRAPH_API_VERSION,
  describeMetaError,
  normalizePhoneNumber,
  type MetaApiError,
} from "@/lib/notifications/meta-whatsapp";
import type {
  MetaAnalyticsPoint,
  MetaCommerceSettings,
  MetaQrCode,
  MetaSubscribedApp,
  MetaBusinessProfile,
  MetaPhoneNumber,
  MetaTemplate,
  MetaTemplateComponent,
  MetaWabaInfo,
} from "@/lib/whatsapp/meta-types";

// Thin wrapper over Meta's WhatsApp Business (Graph) API — everything the
// admin "WhatsApp" menu reads or manages live from Meta: the WhatsApp
// Business Account (WABA), its phone number, business profile, message
// templates, and free-form / template sends.
//
// Env:
//   META_WHATSAPP_ACCESS_TOKEN        — system-user token (whatsapp_business_management + whatsapp_business_messaging)
//   META_WHATSAPP_PHONE_NUMBER_ID     — the sending phone number's ID
//   META_WHATSAPP_BUSINESS_ACCOUNT_ID — the WABA ID (needed for templates / account info)
//   META_APP_SECRET                   — optional; verifies webhook signatures

export type GraphResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; metaError?: unknown };

export function getMetaConfigStatus() {
  return {
    accessToken: Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: Boolean(process.env.META_WHATSAPP_PHONE_NUMBER_ID),
    businessAccountId: Boolean(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID),
    webhookVerifyToken: Boolean(process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    appSecret: Boolean(process.env.META_APP_SECRET),
  };
}

async function graphRequest<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: unknown; query?: Record<string, string> } = {}
): Promise<GraphResult<T>> {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, status: 500, error: "META_WHATSAPP_ACCESS_TOKEN is not configured" };
  }

  const url = path.startsWith("https://")
    ? new URL(path)
    : new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);

  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Meta Graph API error:", path, JSON.stringify(json?.error ?? json));
      return {
        ok: false,
        status: response.status,
        error: describeMetaError(json?.error as MetaApiError | undefined, response.status),
        metaError: json?.error ?? json,
      };
    }
    return { ok: true, data: json as T };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : "Failed to reach Meta Graph API",
    };
  }
}

function requireWabaId(): string | null {
  return process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || null;
}

function requirePhoneNumberId(): string | null {
  return process.env.META_WHATSAPP_PHONE_NUMBER_ID || null;
}

const MISSING_WABA: GraphResult<never> = {
  ok: false,
  status: 500,
  error: "META_WHATSAPP_BUSINESS_ACCOUNT_ID is not configured",
};
const MISSING_PHONE: GraphResult<never> = {
  ok: false,
  status: 500,
  error: "META_WHATSAPP_PHONE_NUMBER_ID is not configured",
};

// ---------------------------------------------------------------- account

const WABA_BASIC_FIELDS =
  "id,name,currency,timezone_id,message_template_namespace,account_review_status";
const WABA_EXTENDED_FIELDS = `${WABA_BASIC_FIELDS},business_verification_status,ownership_type,country,owner_business_info,health_status`;

/**
 * WABA details. Some extended fields need extra permissions (e.g.
 * business_management) and Meta fails the *whole* request if one field is
 * not allowed — so fall back to the basic set rather than showing nothing.
 */
export async function getWabaInfo(): Promise<GraphResult<MetaWabaInfo>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;
  const extended = await graphRequest<MetaWabaInfo>(wabaId, { query: { fields: WABA_EXTENDED_FIELDS } });
  if (extended.ok) return extended;
  return graphRequest<MetaWabaInfo>(wabaId, { query: { fields: WABA_BASIC_FIELDS } });
}

const PHONE_FIELDS =
  "id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,platform_type,status,account_mode,is_official_business_account,throughput";

/** Every phone number registered on the WABA. */
export async function listPhoneNumbers(): Promise<GraphResult<MetaPhoneNumber[]>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;
  const result = await graphRequest<{ data: MetaPhoneNumber[] }>(`${wabaId}/phone_numbers`, {
    query: { fields: PHONE_FIELDS },
  });
  return result.ok ? { ok: true, data: result.data.data ?? [] } : result;
}

/** Meta's own daily sent/delivered counts for the WABA (all numbers). */
export async function getMessagingAnalytics(days = 30): Promise<GraphResult<MetaAnalyticsPoint[]>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 60 * 60;
  const result = await graphRequest<{
    analytics?: { data_points?: MetaAnalyticsPoint[] };
  }>(wabaId, { query: { fields: `analytics.start(${start}).end(${end}).granularity(DAY)` } });
  return result.ok ? { ok: true, data: result.data.analytics?.data_points ?? [] } : result;
}

/** Apps subscribed to this WABA's webhooks — if yours isn't listed, the Inbox and ticks won't update. */
export async function getSubscribedApps(): Promise<GraphResult<MetaSubscribedApp[]>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;
  const result = await graphRequest<{ data: MetaSubscribedApp[] }>(`${wabaId}/subscribed_apps`);
  return result.ok ? { ok: true, data: result.data.data ?? [] } : result;
}

/** Subscribes the token's app to this WABA's webhooks. */
export async function subscribeApp(): Promise<GraphResult<{ success: boolean }>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;
  return graphRequest(`${wabaId}/subscribed_apps`, { method: "POST" });
}

export async function getCommerceSettings(): Promise<GraphResult<MetaCommerceSettings>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  const result = await graphRequest<{ data: MetaCommerceSettings[] }>(
    `${phoneNumberId}/whatsapp_commerce_settings`
  );
  return result.ok ? { ok: true, data: result.data.data?.[0] ?? {} } : result;
}

// ---------------------------------------------------- QR codes / short links

export async function listQrCodes(): Promise<GraphResult<MetaQrCode[]>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  const result = await graphRequest<{ data: MetaQrCode[] }>(`${phoneNumberId}/message_qrdls`, {
    query: { fields: "code,prefilled_message,deep_link_url,qr_image_url.format(PNG)" },
  });
  return result.ok ? { ok: true, data: result.data.data ?? [] } : result;
}

export async function createQrCode(prefilledMessage: string): Promise<GraphResult<MetaQrCode>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  return graphRequest<MetaQrCode>(`${phoneNumberId}/message_qrdls`, {
    method: "POST",
    query: { prefilled_message: prefilledMessage, generate_qr_image: "PNG" },
  });
}

export async function deleteQrCode(code: string): Promise<GraphResult<{ success: boolean }>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  return graphRequest(`${phoneNumberId}/message_qrdls/${encodeURIComponent(code)}`, {
    method: "DELETE",
  });
}

export async function getPhoneNumberInfo(): Promise<GraphResult<MetaPhoneNumber>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  return graphRequest<MetaPhoneNumber>(phoneNumberId, {
    query: {
      fields:
        "id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,platform_type,status,account_mode,is_official_business_account,throughput",
    },
  });
}

export async function getBusinessProfile(): Promise<GraphResult<MetaBusinessProfile>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  const result = await graphRequest<{ data: MetaBusinessProfile[] }>(
    `${phoneNumberId}/whatsapp_business_profile`,
    { query: { fields: "about,address,description,email,profile_picture_url,websites,vertical" } }
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.data?.[0] ?? {} };
}

export async function updateBusinessProfile(
  profile: Omit<MetaBusinessProfile, "profile_picture_url">
): Promise<GraphResult<{ success: boolean }>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  return graphRequest(`${phoneNumberId}/whatsapp_business_profile`, {
    method: "POST",
    body: { messaging_product: "whatsapp", ...profile },
  });
}

// -------------------------------------------------------------- templates

const TEMPLATE_FIELDS =
  "id,name,language,status,category,sub_category,parameter_format,components,quality_score,rejected_reason";

/** Every message template on the WABA, following Meta's cursor paging. */
export async function listMessageTemplates(): Promise<GraphResult<MetaTemplate[]>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;

  const templates: MetaTemplate[] = [];
  let next: string | null = `${wabaId}/message_templates`;
  let query: Record<string, string> | undefined = { fields: TEMPLATE_FIELDS, limit: "100" };
  // Hard stop so a paging bug can never loop forever.
  for (let page = 0; next && page < 20; page += 1) {
    const result: GraphResult<{ data: MetaTemplate[]; paging?: { next?: string } }> =
      await graphRequest(next, { query });
    if (!result.ok) return result;
    templates.push(...(result.data.data ?? []));
    next = result.data.paging?.next ?? null;
    query = undefined; // paging.next already carries every query param
  }
  return { ok: true, data: templates };
}

export interface CreateTemplateInput {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING";
  components: MetaTemplateComponent[];
}

export async function createMessageTemplate(
  input: CreateTemplateInput
): Promise<GraphResult<{ id: string; status: string; category: string }>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;
  return graphRequest(`${wabaId}/message_templates`, {
    method: "POST",
    body: { ...input, parameter_format: "POSITIONAL" },
  });
}

/** Deletes one language version (by hsm_id) — or every language of the name when no id is given. */
export async function deleteMessageTemplate(
  name: string,
  templateId?: string
): Promise<GraphResult<{ success: boolean }>> {
  const wabaId = requireWabaId();
  if (!wabaId) return MISSING_WABA;
  return graphRequest(`${wabaId}/message_templates`, {
    method: "DELETE",
    query: { name, ...(templateId ? { hsm_id: templateId } : {}) },
  });
}

// -------------------------------------------------------------- messaging

interface SendResponse {
  messages?: { id: string }[];
  contacts?: { wa_id?: string; input?: string }[];
}

export interface SendOutcome {
  messageId?: string;
  waId: string;
}

function toSendOutcome(data: SendResponse, to: string): SendOutcome {
  return { messageId: data.messages?.[0]?.id, waId: data.contacts?.[0]?.wa_id ?? to };
}

/** Free-form text — only deliverable inside the 24h customer-service window. */
export async function sendTextMessage(to: string, body: string): Promise<GraphResult<SendOutcome>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  const recipient = normalizePhoneNumber(to);
  const result = await graphRequest<SendResponse>(`${phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: true, body },
    },
  });
  return result.ok ? { ok: true, data: toSendOutcome(result.data, recipient) } : result;
}

export interface TemplateSendInput {
  to: string;
  templateName: string;
  language: string;
  headerText?: string[];
  headerMedia?: { type: "document" | "image" | "video"; link: string; filename?: string };
  bodyParams?: string[];
  // index = button position in the template; only URL buttons with a
  // {{1}} suffix take a parameter.
  urlButtonParams?: { index: number; text: string }[];
}

/** Any approved template, with header / body / URL-button parameters built from the form. */
export async function sendTemplate(input: TemplateSendInput): Promise<GraphResult<SendOutcome>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;

  const components: Record<string, unknown>[] = [];
  if (input.headerMedia) {
    const { type, link, filename } = input.headerMedia;
    components.push({
      type: "header",
      parameters: [{ type, [type]: { link, ...(type === "document" && filename ? { filename } : {}) } }],
    });
  } else if (input.headerText && input.headerText.length > 0) {
    components.push({
      type: "header",
      parameters: input.headerText.map((text) => ({ type: "text", text })),
    });
  }
  if (input.bodyParams && input.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  for (const button of input.urlButtonParams ?? []) {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(button.index),
      parameters: [{ type: "text", text: button.text }],
    });
  }

  const recipient = normalizePhoneNumber(input.to);
  const result = await graphRequest<SendResponse>(`${phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        ...(components.length > 0 ? { components } : {}),
      },
    },
  });
  return result.ok ? { ok: true, data: toSendOutcome(result.data, recipient) } : result;
}

/** Blue ticks for the customer — marks an inbound message as read. */
export async function markMessageRead(messageId: string): Promise<GraphResult<{ success: boolean }>> {
  const phoneNumberId = requirePhoneNumberId();
  if (!phoneNumberId) return MISSING_PHONE;
  return graphRequest(`${phoneNumberId}/messages`, {
    method: "POST",
    body: { messaging_product: "whatsapp", status: "read", message_id: messageId },
  });
}

// ---------------------------------------------------------------- webhook

/**
 * Checks Meta's X-Hub-Signature-256 header against the raw request body.
 * Returns true when META_APP_SECRET isn't set (verification opt-in), so
 * existing deployments keep working until the secret is added.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}
