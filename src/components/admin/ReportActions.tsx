"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";

/** Copy the report as plain text, or print it / save it as a PDF. */
export function ReportActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="report-no-print grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            window.prompt("Copy the report", text);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
      >
        {copied ? <Check className="size-4 text-approve" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy as text"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white"
      >
        <Printer className="size-4" /> Print or PDF
      </button>
    </div>
  );
}
