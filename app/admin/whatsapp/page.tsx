import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { SETTINGS_ROLES } from "@/lib/auth/roles";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/models/Settings";
import { WhatsAppTemplate } from "@/models/WhatsAppTemplate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppSettingsForm } from "@/components/admin/whatsapp-settings-form";
import { WhatsAppTemplatesClient } from "@/components/admin/whatsapp-templates-client";
import { WhatsAppLogList } from "@/components/admin/whatsapp-log-list";
import { WhatsAppTestDialog } from "@/components/admin/whatsapp-test-dialog";
import { isWhatsAppConfigured } from "@/lib/notifications/brevo-whatsapp";
import { isMetaWhatsAppConfigured } from "@/lib/notifications/meta-whatsapp";
import { DEFAULT_WHATSAPP_SETTINGS, type WhatsAppSettingsInput } from "@/lib/validations/whatsapp-settings";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function AdminWhatsAppPage() {
  const currentUser = await requireRole(SETTINGS_ROLES);
  if (!currentUser) {
    redirect("/admin");
  }

  await connectToDatabase();

  const [settingsDoc, templates] = await Promise.all([
    Settings.findOne({ module: "whatsapp" }).lean(),
    WhatsAppTemplate.find().sort({ triggerEvent: 1, createdAt: -1 }).lean(),
  ]);

  const settings = (settingsDoc?.data as WhatsAppSettingsInput) ?? DEFAULT_WHATSAPP_SETTINGS;
  const brevoConfigured = isWhatsAppConfigured();
  const metaConfigured = isMetaWhatsAppConfigured();
  const configured = settings.provider === "meta" ? metaConfigured : brevoConfigured;
  const activeTemplateCount = templates.filter((t) => t.isActive).length;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Order updates, notifications, and message templates via Brevo.
          </p>
        </div>
        <WhatsAppTestDialog />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
            <MessageCircle className="h-6 w-6 text-white" fill="white" strokeWidth={0} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-heading text-lg">WhatsApp Business API</p>
              <span
                className={
                  configured
                    ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }
              >
                {configured ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {configured ? "Connected" : "Not Configured"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Provider: {settings.provider === "meta" ? "Meta Cloud API" : "Brevo"} &middot; Sender:{" "}
              {settings.senderLabel ? (
                <span className="font-medium text-foreground">{settings.senderLabel}</span>
              ) : (
                "not set"
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-6 border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Templates</p>
            <p className="mt-0.5 font-heading text-xl">{templates.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Active</p>
            <p className="mt-0.5 font-heading text-xl">{activeTemplateCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Auto-Send</p>
            <p className="mt-0.5 font-heading text-xl">{settings.enabled ? "On" : "Off"}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="log">Message Log</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <WhatsAppSettingsForm
            initialSettings={settings}
            isBrevoConfigured={brevoConfigured}
            isMetaConfigured={metaConfigured}
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <WhatsAppTemplatesClient
            initialTemplates={templates.map((template) => ({
              _id: String(template._id),
              name: template.name,
              triggerEvent: template.triggerEvent,
              brevoTemplateId: template.brevoTemplateId,
              metaTemplateName: template.metaTemplateName,
              metaLanguageCode: template.metaLanguageCode,
              previewBody: template.previewBody,
              isActive: template.isActive,
            }))}
          />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <WhatsAppLogList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
