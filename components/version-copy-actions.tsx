"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function VersionCopyActions({
  designSpec,
  imagePrompt,
  compact = false,
}: {
  designSpec: string;
  imagePrompt: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"spec" | "prompt" | null>(null);

  async function copy(value: string, type: "spec" | "prompt") {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const classes = `inline-flex items-center justify-center gap-2 rounded-xl border border-violet/25 bg-white font-bold text-violet transition hover:border-violet hover:bg-violet/[0.03] ${
    compact ? "h-9 px-3 text-xs" : "h-11 px-4 text-sm"
  }`;

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!designSpec} onClick={() => copy(designSpec, "spec")} className={classes}>
        {copied === "spec" ? <Check size={15} /> : <Copy size={15} />}
        {copied === "spec" ? "Скопировано" : "Копировать спецификацию"}
      </button>
      <button type="button" disabled={!imagePrompt} onClick={() => copy(imagePrompt, "prompt")} className={classes}>
        {copied === "prompt" ? <Check size={15} /> : <Copy size={15} />}
        {copied === "prompt" ? "Скопировано" : "Копировать промпт"}
      </button>
    </div>
  );
}
