import { CheckCheck, ExternalLink, FileText, Image as ImageIcon, Phone, Reply, Video } from "lucide-react";
import { fillPositional, type MetaTemplate } from "@/lib/whatsapp/meta-types";

/**
 * Renders a Meta template the way it looks in WhatsApp: header (text or
 * media), body, footer and buttons. Variables are filled from `values`
 * when given, otherwise from the example values the template was approved
 * with, so the preview reads like a real message.
 */
export function MetaTemplatePreview({
  template,
  values,
}: {
  template: Pick<MetaTemplate, "components">;
  values?: { header?: string[]; body?: string[] };
}) {
  const header = template.components.find((c) => c.type === "HEADER");
  const body = template.components.find((c) => c.type === "BODY");
  const footer = template.components.find((c) => c.type === "FOOTER");
  const buttons = template.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];

  const bodyValues = values?.body?.some(Boolean) ? values.body : body?.example?.body_text?.[0] ?? [];
  const headerValues = values?.header?.some(Boolean) ? values.header : header?.example?.header_text ?? [];

  const MediaIcon =
    header?.format === "IMAGE" ? ImageIcon : header?.format === "VIDEO" ? Video : FileText;

  return (
    <div
      className="rounded-lg p-3"
      style={{
        backgroundColor: "#e5ddd5",
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0, 12px 12px",
      }}
    >
      <div className="max-w-[92%] overflow-hidden rounded-lg rounded-tl-none bg-white shadow-sm">
        {header && header.format && header.format !== "TEXT" && (
          <div className="m-1 flex items-center gap-2 rounded-md bg-[#f0f2f5] px-3 py-3 text-[#54656f]">
            <MediaIcon className="h-5 w-5 shrink-0" />
            <span className="text-xs font-medium uppercase tracking-wide">
              {header.format.toLowerCase()} attached
            </span>
          </div>
        )}
        <div className="px-3 pt-2 pb-1">
          {header?.format === "TEXT" && header.text && (
            <p className="mb-1 text-sm font-semibold text-[#111b21]">
              {fillPositional(header.text, headerValues ?? [])}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#111b21]">
            {body?.text ? fillPositional(body.text, bodyValues ?? []) : "—"}
          </p>
          {footer?.text && <p className="mt-1 text-xs text-[#667781]">{footer.text}</p>}
          <div className="mt-0.5 flex items-center justify-end gap-1">
            <span className="text-[10px] text-[#667781]">
              {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
          </div>
        </div>
        {buttons.map((button, index) => {
          const Icon =
            button.type === "URL" ? ExternalLink : button.type === "PHONE_NUMBER" ? Phone : Reply;
          return (
            <div
              key={index}
              className="flex items-center justify-center gap-1.5 border-t border-[#e9edef] py-2 text-sm font-medium text-[#008069]"
              title={button.url ?? button.phone_number}
            >
              <Icon className="h-4 w-4" /> {button.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
