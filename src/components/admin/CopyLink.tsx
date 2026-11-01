"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { brand } from "@/config/brand";

export function CopyLink({ path, label = "Copy link", className = "" }: { path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Always hand out the real domain, even when the admin is open on a preview URL.
        const origin = window.location.hostname === "localhost" ? window.location.origin : brand.siteUrl;
        const url = `${origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("Copy this link", url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 ${className}`}
    >
      {copied ? <Check className="size-4 text-approve" /> : <Link2 className="size-4" />}
      {copied ? "Copied" : label}
    </button>
  );
}
