import { NextRequest } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connect";
import { WhatsAppTemplate } from "@/models/WhatsAppTemplate";
import { requireApiRole } from "@/lib/api/require-role";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { apiSuccess, apiError, apiErrorFromUnknown } from "@/lib/api/response";
import { recordAuditLog } from "@/lib/audit/log";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
} from "@/lib/whatsapp/meta-graph";
import { countPositionalParams, type MetaTemplateComponent } from "@/lib/whatsapp/meta-types";

/** Every template on the WhatsApp Business Account, live from Meta, with its app trigger mapping. */
export async function GET(): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const result = await listMessageTemplates();
    if (!result.ok) return apiError(result.error, result.status >= 500 ? 502 : 400);

    await connectToDatabase();
    const local = await WhatsAppTemplate.find({ metaTemplateName: { $exists: true, $ne: "" } })
      .select("metaTemplateName triggerEvent isActive")
      .lean();
    const mappings: Record<string, { triggerEvent: string; isActive: boolean }[]> = {};
    for (const row of local) {
      const key = row.metaTemplateName!;
      (mappings[key] ??= []).push({ triggerEvent: row.triggerEvent, isActive: row.isActive });
    }

    return apiSuccess({ templates: result.data, mappings });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

const buttonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().trim().min(1).max(25) }),
  z.object({
    type: z.literal("URL"),
    text: z.string().trim().min(1).max(25),
    url: z.string().trim().url("Button URL must be a full https:// link").max(2000),
    example: z.string().trim().optional(),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().trim().min(1).max(25),
    phone_number: z.string().trim().regex(/^\+?\d{8,15}$/, "Phone must include country code"),
  }),
]);

const createSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[a-z0-9_]+$/, "Name: lowercase letters, numbers and underscores only"),
    language: z.string().trim().min(2).max(10),
    category: z.enum(["UTILITY", "MARKETING"]),
    headerText: z.string().trim().max(60).optional(),
    headerExample: z.string().trim().optional(),
    body: z.string().trim().min(1, "Body is required").max(1024),
    bodyExamples: z.array(z.string().trim().min(1, "Fill in every example value")),
    footer: z.string().trim().max(60).optional(),
    buttons: z.array(buttonSchema).max(10),
  })
  .refine((d) => d.bodyExamples.length === countPositionalParams(d.body), {
    message: "Give one example value for each {{n}} variable in the body",
    path: ["bodyExamples"],
  })
  .refine((d) => countPositionalParams(d.headerText) <= 1, {
    message: "The header can contain at most one variable ({{1}})",
    path: ["headerText"],
  });

/** Submits a new template to Meta for review. */
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const input = createSchema.parse(await request.json());
    const components: MetaTemplateComponent[] = [];

    if (input.headerText) {
      const needsExample = countPositionalParams(input.headerText) === 1;
      if (needsExample && !input.headerExample) {
        return apiError("Give an example value for the header variable", 422);
      }
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: input.headerText,
        ...(needsExample ? { example: { header_text: [input.headerExample!] } } : {}),
      });
    }
    components.push({
      type: "BODY",
      text: input.body,
      ...(input.bodyExamples.length > 0 ? { example: { body_text: [input.bodyExamples] } } : {}),
    });
    if (input.footer) components.push({ type: "FOOTER", text: input.footer });
    if (input.buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: input.buttons.map((button) =>
          button.type === "URL" && /\{\{\s*1\s*\}\}/.test(button.url)
            ? { ...button, example: [button.example || button.url.replace(/\{\{\s*1\s*\}\}/, "sample")] }
            : { ...button, example: undefined }
        ),
      });
    }

    const result = await createMessageTemplate({
      name: input.name,
      language: input.language,
      category: input.category,
      components,
    });
    if (!result.ok) return apiError(result.error, result.status >= 500 ? 502 : 400);

    await recordAuditLog({
      entityType: "WhatsAppMetaTemplate",
      entityId: result.data.id,
      action: "create",
      actor: auth.user,
      snapshot: { name: input.name, language: input.language, category: input.category, components },
    });
    return apiSuccess({ template: result.data }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

/** Deletes a template from Meta (?name=...&id=... — id limits it to one language). */
export async function DELETE(request: NextRequest): Promise<Response> {
  const auth = await requireApiRole(SETTINGS_ROLES);
  if ("error" in auth) return auth.error;

  try {
    const name = request.nextUrl.searchParams.get("name");
    const id = request.nextUrl.searchParams.get("id") ?? undefined;
    if (!name) return apiError("Template name is required", 400);

    const result = await deleteMessageTemplate(name, id);
    if (!result.ok) return apiError(result.error, result.status >= 500 ? 502 : 400);

    // A deleted Meta template can't be sent any more — switch off any app
    // trigger still pointing at it so auto-sends don't fail silently.
    await connectToDatabase();
    await WhatsAppTemplate.updateMany(
      { metaTemplateName: name, ...(id ? { metaTemplateId: id } : {}) },
      { isActive: false, metaStatus: "DELETED" }
    );

    await recordAuditLog({
      entityType: "WhatsAppMetaTemplate",
      entityId: id ?? name,
      action: "delete",
      actor: auth.user,
      snapshot: { name, id },
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
