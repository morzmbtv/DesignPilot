"use client";

import { Braces, Check, ChevronRight, Eye, Loader2, X } from "lucide-react";
import { useState } from "react";
import { previewScreenAiContext, type AiContextPreviewResult } from "@/app/projects/[id]/screens/[screenId]/ai-actions";

type Preview = Extract<AiContextPreviewResult, { ok: true }>;

export function AiContextViewer({ projectId, screenId }: { projectId: string; screenId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function showPreview() {
    setOpen(true);
    if (preview) return;
    setLoading(true);
    const result = await previewScreenAiContext(projectId, screenId);
    if (result.ok) setPreview(result);
    else setError(result.error);
    setLoading(false);
  }

  return (
    <>
      <button type="button" onClick={showPreview} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink hover:border-violet/30 hover:text-violet">
        <Eye size={16} /> Preview Context
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" role="dialog" aria-modal="true" aria-label="AI Context Viewer">
          <button aria-label="Закрыть контекст" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-violet">AI Context Viewer</p>
                <h2 className="mt-2 text-2xl font-black">Контекст следующего вызова</h2>
              </div>
              <button onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-xl border border-line"><X size={18} /></button>
            </div>
            {loading ? <p className="mt-10 flex items-center gap-2 text-sm text-muted"><Loader2 className="animate-spin" size={17} /> Собираем контекст…</p> : null}
            {error ? <p className="mt-8 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
            {preview ? (
              <>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <ContextCard label="Project Memory" value={preview.projectMemory} />
                  <ContextCard label="Project Rules" value={`${preview.projectRulesCount} правил`} />
                  <ContextCard label="Approved screens" value={preview.approvedScreens.join(", ") || "Нет"} />
                  <ContextCard label="Related screens" value={preview.relatedScreens.join(", ") || "Нет"} />
                  <ContextCard label="Approved summaries" value={`${preview.approvedSummaries.length} summary`} />
                  <ContextCard label="Selected model" value={preview.model} />
                  <ContextCard label="Constraints" value={preview.constraints || "Не заданы"} wide />
                </div>
                <details className="mt-6 rounded-2xl border border-line bg-[#fafaff] p-5" open>
                  <summary className="flex cursor-pointer list-none items-center gap-2 font-black"><Braces size={17} className="text-violet" /> Raw context <ChevronRight size={15} /></summary>
                  <pre className="mt-4 max-h-[48vh] overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink">{preview.rawContext}</pre>
                </details>
              </>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ContextCard({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-line p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-muted"><Check size={13} className="text-emerald-600" /> {label}</p>
      <p className="mt-2 text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}
