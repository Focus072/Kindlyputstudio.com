"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { brand } from "@/config/brand";

export function CopyLink({ path, label = "Copy link", context, className = "" }: { path: string; label?: string; context?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={context ? `${label} for ${context}` : label}
        onClick={async (event) => {
          event.preventDefault();
          event.stopPropagation();
          // Preview deployments still hand out production links. Local fixtures stay local.
          const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
          const url = `${local ? window.location.origin : brand.siteUrl}${path}`;
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            window.prompt("Copy this link", url);
          }
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 ${className}`}
      >
        {copied ? <Check aria-hidden className="size-4 shrink-0 text-approve" /> : <Link2 aria-hidden className="size-4 shrink-0" />}
        {copied ? "Copied" : label}
      </button>
      <span role="status" className="sr-only">{copied ? "Client link copied." : ""}</span>
    </>
  );
}
