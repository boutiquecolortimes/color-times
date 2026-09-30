import "server-only";
import { WhatsAppTemplate } from "@/models/WhatsAppTemplate";
import {
  TRIGGER_EVENTS,
  TRIGGER_EVENT_LABELS,
  TRIGGER_EVENT_VARIABLES,
  type WhatsAppTriggerEvent,
  type WhatsAppHeaderType,
} from "@/lib/notifications/trigger-events";
import { countPositionalParams, getComponent, type MetaTemplate } from "@/lib/whatsapp/meta-types";

// Meta template names that don't match a trigger event 1:1.
const NAME_ALIASES: Record<string, WhatsAppTriggerEvent> = {
  confirm_it_is_typed_as_booking_confirmed: "booking_confirmed",
  booking_confirmation: "booking_confirmed",
};

export function guessTriggerEvent(metaName: string): WhatsAppTriggerEvent {
  if (NAME_ALIASES[metaName]) return NAME_ALIASES[metaName];
  if ((TRIGGER_EVENTS as readonly string[]).includes(metaName)) {
    return metaName as WhatsAppTriggerEvent;
  }
  return "custom";
}

export function describeMetaStatus(template: Pick<MetaTemplate, "status" | "quality_score">): string {
  const quality = template.quality_score?.score;
  return quality && quality !== "UNKNOWN" ? `${template.status} · Quality ${quality}` : template.status;
}

/** Turns Meta's {{1}}, {{2}} body into the app's named-variable preview ({{customerName}}, ...). */
function toNamedPreview(body: string, trigger: WhatsAppTriggerEvent): string {
  const names = TRIGGER_EVENT_VARIABLES[trigger] ?? [];
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index: string) => {
    const name = trigger === "custom" ? undefined : names[Number(index) - 1];
    return name ? `{{${name}}}` : match;
  });
}

function humanize(metaName: string): string {
  return metaName
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export interface SyncReport {
  created: string[];
  updated: string[];
  warnings: string[];
}

/**
 * Brings the app's trigger-mapped templates in line with what's actually on
 * Meta: status/quality, template ID, language, header type and preview
 * text. Templates new to the app are added *inactive* — activating one
 * changes what customers receive, so that stays a deliberate staff action.
 */
export async function syncTemplatesFromMeta(metaTemplates: MetaTemplate[]): Promise<SyncReport> {
  const report: SyncReport = { created: [], updated: [], warnings: [] };

  for (const meta of metaTemplates) {
    if (meta.status === "DELETED" || meta.status === "PENDING_DELETION") continue;

    const header = getComponent(meta, "HEADER");
    const body = getComponent(meta, "BODY")?.text ?? "";
    const headerFormat = header?.format ?? "NONE";
    const metaHeaderType: WhatsAppHeaderType = headerFormat === "DOCUMENT" ? "document" : "none";

    const existing = await WhatsAppTemplate.findOne({ metaTemplateName: meta.name });
    const trigger = existing?.triggerEvent ?? guessTriggerEvent(meta.name);

    if (headerFormat === "IMAGE" || headerFormat === "VIDEO") {
      report.warnings.push(
        `${meta.name}: has an ${headerFormat.toLowerCase()} header — automatic sends can't attach it yet; use the Send tab.`
      );
    }
    const expected = TRIGGER_EVENT_VARIABLES[trigger]?.length ?? 0;
    const actual = countPositionalParams(body);
    if (trigger !== "custom" && expected !== actual) {
      report.warnings.push(
        `${meta.name}: Meta body has ${actual} variables but "${TRIGGER_EVENT_LABELS[trigger]}" sends ${expected} — sends will be rejected until they match.`
      );
    }
    const urlButtons = getComponent(meta, "BUTTONS")?.buttons?.filter((b) => b.type === "URL") ?? [];
    if (urlButtons.some((b) => /\{\{\s*1\s*\}\}/.test(b.url ?? "")) && trigger !== "custom") {
      report.warnings.push(`${meta.name}: dynamic URL button isn't filled by automatic sends yet.`);
    }

    const fields = {
      metaTemplateId: meta.id,
      metaStatus: describeMetaStatus(meta),
      metaLanguageCode: meta.language,
      metaHeaderType,
      previewBody: toNamedPreview(body, trigger) || meta.name,
    };

    if (existing) {
      await WhatsAppTemplate.updateOne({ _id: existing._id }, fields);
      report.updated.push(meta.name);
    } else {
      await WhatsAppTemplate.create({
        ...fields,
        name: humanize(meta.name),
        triggerEvent: trigger,
        metaTemplateName: meta.name,
        isActive: false,
      });
      report.created.push(meta.name);
    }
  }

  return report;
}
