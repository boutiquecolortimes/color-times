// Client-safe shapes for data coming back from Meta's WhatsApp Business
// (Graph) API. No server imports here — this file is shared by route
// handlers and "use client" admin components alike.

export type MetaTemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | "PENDING_DELETION"
  | "DELETED"
  | "LIMIT_EXCEEDED"
  | string;

export type MetaTemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION" | string;

export interface MetaTemplateButton {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY" | "COPY_CODE" | "OTP" | "FLOW" | string;
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

export interface MetaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS" | string;
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | string;
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: MetaTemplateButton[];
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: MetaTemplateStatus;
  category: MetaTemplateCategory;
  sub_category?: string;
  parameter_format?: "POSITIONAL" | "NAMED" | string;
  components: MetaTemplateComponent[];
  quality_score?: { score?: string; date?: number };
  rejected_reason?: string;
}

export interface MetaPhoneNumber {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: "GREEN" | "YELLOW" | "RED" | "UNKNOWN" | string;
  code_verification_status?: string;
  name_status?: string;
  messaging_limit_tier?: string;
  platform_type?: string;
  status?: string;
  account_mode?: string;
  is_official_business_account?: boolean;
  throughput?: { level?: string };
}

export interface MetaBusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
}

export interface MetaWabaInfo {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
  message_template_namespace?: string;
  account_review_status?: string;
  business_verification_status?: string;
  ownership_type?: string;
  country?: string;
  owner_business_info?: { id?: string; name?: string };
  health_status?: {
    can_send_message?: string;
    entities?: { entity_type?: string; id?: string; can_send_message?: string; errors?: { error_description?: string }[] }[];
  };
}

export interface MetaAnalyticsPoint {
  start: number;
  end: number;
  sent: number;
  delivered: number;
}

export interface MetaSubscribedApp {
  whatsapp_business_api_data?: { id?: string; name?: string; link?: string };
}

export interface MetaCommerceSettings {
  id?: string;
  is_cart_enabled?: boolean;
  is_catalog_visible?: boolean;
}

export interface MetaQrCode {
  code: string;
  prefilled_message: string;
  deep_link_url: string;
  qr_image_url?: string;
}

export const BUSINESS_VERTICALS = [
  "UNDEFINED",
  "OTHER",
  "AUTO",
  "BEAUTY",
  "APPAREL",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GROCERY",
  "GOVT",
  "HOTEL",
  "HEALTH",
  "NONPROFIT",
  "PROF_SERVICES",
  "RETAIL",
  "TRAVEL",
  "RESTAURANT",
] as const;

/** Counts the {{1}}, {{2}}... placeholders in a template text (highest index wins). */
export function countPositionalParams(text?: string): number {
  if (!text) return 0;
  let max = 0;
  for (const match of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) {
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

/** Substitutes {{1}}, {{2}}... with the given values (1-indexed), leaving unknown ones intact. */
export function fillPositional(text: string, values: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index: string) => {
    const value = values[Number(index) - 1];
    return value ? value : match;
  });
}

export function getComponent(template: Pick<MetaTemplate, "components">, type: string) {
  return template.components.find((component) => component.type === type);
}
