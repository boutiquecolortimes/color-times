import { Check, CheckCheck } from "lucide-react";
import { renderTemplate } from "@/lib/notifications/render-template";

/** Realistic sample values so a template preview reads like a real message, not `{{customerName}}`. */
export const SAMPLE_TEMPLATE_VARIABLES: Record<string, string> = {
  customerName: "Priya Sharma",
  bookingNumber: "CTB-2026-01042",
  productName: "Rose Gold Lehenga",
  eventDate: "15 Aug 2026",
  rentalStartDate: "12 Aug 2026",
  rentalEndDate: "16 Aug 2026",
  totalAmount: "8,500",
  invoiceNumber: "INV-00042",
  amountDue: "2,000",
  amountPaid: "6,500",
  dueDate: "20 Aug 2026",
  billNumber: "BILL-00042",
  advancePayment: "3,000",
};

/** A WhatsApp-chat-accurate bubble mockup — outgoing business message on the WhatsApp wallpaper. */
export function WhatsAppChatBubble({ text, delivered = true }: { text: string; delivered?: boolean }) {
  const rendered = renderTemplate(text || "Your message preview will appear here.", SAMPLE_TEMPLATE_VARIABLES);

  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: "#e5ddd5",
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundPosition: "0 0, 12px 12px",
      }}
    >
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 shadow-sm">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#111b21]">
          {rendered}
        </p>
        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] text-[#667781]">
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {delivered ? (
            <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
          ) : (
            <Check className="h-3.5 w-3.5 text-[#667781]" />
          )}
        </div>
      </div>
    </div>
  );
}
