"use client";

import { useEffect, useRef, useState } from "react";
import { buildInvoicePdf, type InvoicePdfData } from "@/lib/admin/invoice-pdf";

type State = { kind: "building" } | { kind: "ready"; url: string; file: File } | { kind: "error"; message: string };

export function HindiBill({ invoice }: { invoice: InvoicePdfData }) {
  const [state, setState] = useState<State>({ kind: "building" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    buildInvoicePdf(invoice, "hi")
      .then((doc) => {
        const blob = doc.output("blob");
        const name = `${invoice.invoiceNumber}-hi.pdf`;
        setState({ kind: "ready", url: URL.createObjectURL(blob), file: new File([blob], name, { type: "application/pdf" }) });
      })
      .catch((error: unknown) =>
        setState({ kind: "error", message: error instanceof Error ? error.message : "Could not build the bill" })
      );
  }, [invoice]);

  const canShare =
    state.kind === "ready" &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [state.file] });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#0E0C0B] px-6 text-center text-[#F4EDE2]">
      <p className="text-xs uppercase tracking-[0.3em] text-[#C9A35C]">Color Times</p>
      <h1 className="font-heading text-3xl">बिल {invoice.invoiceNumber}</h1>
      {state.kind === "building" && <p className="text-sm text-[#B3A796]">हिंदी बिल तैयार हो रहा है… (Preparing your Hindi bill)</p>}
      {state.kind === "error" && <p className="text-sm text-[#D2766B]">{state.message}</p>}
      {state.kind === "ready" && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <a
            href={state.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#C9A35C] px-6 py-3 text-sm font-semibold text-[#1A140B]"
          >
            बिल खोलें / Open PDF
          </a>
          <a
            href={state.url}
            download={state.file.name}
            className="rounded-full border border-[#8E6F36] px-6 py-3 text-sm text-[#E2C285]"
          >
            डाउनलोड / Download
          </a>
          {canShare && (
            <button
              type="button"
              onClick={() => void navigator.share({ files: [state.file], title: state.file.name }).catch(() => undefined)}
              className="rounded-full border border-[#40372F] px-6 py-3 text-sm text-[#F4EDE2]"
            >
              शेयर / Share or print
            </button>
          )}
        </div>
      )}
    </main>
  );
}
