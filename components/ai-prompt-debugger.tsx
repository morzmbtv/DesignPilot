"use client";

import { Check, Copy, FileCode2, X } from "lucide-react";
import { useState } from "react";

export type PromptLogView = {
  id: string;
  action: string;
  model: string;
  requestPreview: string;
  fullPrompt: string;
  rawResponse: string | null;
  parsedResponse: string | null;
  error: string | null;
  createdAt: string;
};

export function AiPromptDebugger({ log, label = "Show AI Prompt" }: { log: PromptLogView; label?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-violet hover:border-violet/30"><FileCode2 size={15} /> {label}</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="AI Prompt Debugger">
          <button className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={() => setOpen(false)} />
          <section className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-bold text-violet">AI Prompt Debugger</p><h2 className="mt-2 text-2xl font-black">{log.action}</h2></div>
              <button aria-label="Закрыть debugger" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-xl border border-line"><X size={18} /></button>
            </div>
            <dl className="mt-7 grid gap-4 sm:grid-cols-2">
              <DebugField label="Action" value={log.action} />
              <DebugField label="Model" value={log.model} />
              <DebugField label="Request Preview" value={log.requestPreview} wide />
              <DebugField label="Created At" value={new Date(log.createdAt).toLocaleString("ru-RU")} />
              <DebugField label="Error" value={log.error || "—"} error={Boolean(log.error)} />
            </dl>
            <DebugCode label="Full Prompt" value={log.fullPrompt} onCopy={() => copy(log.fullPrompt, "prompt")} copied={copied === "prompt"} />
            <DebugCode label="Raw Response" value={log.rawResponse || "—"} onCopy={() => copy(log.rawResponse || "", "raw")} copied={copied === "raw"} />
            <DebugCode label="Parsed Response" value={log.parsedResponse || "—"} />
          </section>
        </div>
      ) : null}
    </>
  );
}

function DebugField({ label, value, wide = false, error = false }: { label: string; value: string; wide?: boolean; error?: boolean }) {
  return <div className={`rounded-2xl border border-line p-4 ${wide ? "sm:col-span-2" : ""}`}><dt className="text-xs font-black uppercase tracking-[0.1em] text-muted">{label}</dt><dd className={`mt-2 text-sm leading-6 ${error ? "font-bold text-red-600" : "text-ink"}`}>{value}</dd></div>;
}
function DebugCode({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return <div className="mt-4 rounded-2xl border border-line bg-[#fafaff] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-muted">{label}</p>{onCopy ? <button onClick={onCopy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-violet">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : `Copy ${label}`}</button> : null}</div><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink">{value}</pre></div>;
}
