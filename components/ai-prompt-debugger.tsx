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

export function AiPromptDebugger({ log, label = "Показать AI-промпт", artifacts }: {
  log: PromptLogView;
  label?: string;
  artifacts?: { layoutJson: string | null; htmlLayout: string | null; flutterWidgetTree: string | null; imagePrompt: string };
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const parsed = safeParse(log.parsedResponse);
  const sentLayout = findLayout(safeParse(log.fullPrompt));
  const receivedLayout = parsed?.updatedLayoutJson ?? parsed?.layoutJson ?? null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-violet hover:border-violet/30">
        <FileCode2 size={15} /> {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Отладчик AI-промпта">
          <button className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={() => setOpen(false)} />
          <section className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-bold text-violet">Отладчик AI-промпта</p><h2 className="mt-2 text-2xl font-black">{log.action}</h2></div>
              <button aria-label="Закрыть отладчик" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-xl border border-line"><X size={18} /></button>
            </div>
            <dl className="mt-7 grid gap-4 sm:grid-cols-2">
              <DebugField label="Действие" value={log.action} />
              <DebugField label="Модель" value={log.model} />
              <DebugField label="Предпросмотр запроса" value={log.requestPreview} wide />
              <DebugField label="Создан" value={new Date(log.createdAt).toLocaleString("ru-RU")} />
              <DebugField label="Ошибка" value={log.error || "—"} error={Boolean(log.error)} />
            </dl>
            <DebugCode label="Полный промпт" value={log.fullPrompt} onCopy={() => copy(log.fullPrompt, "prompt")} copied={copied === "prompt"} />
            <DebugCode label="Исходный ответ" value={log.rawResponse || "—"} onCopy={() => copy(log.rawResponse || "", "raw")} copied={copied === "raw"} />
            <DebugCode label="Разобранный ответ" value={log.parsedResponse || "—"} />
            <DebugCode label="layoutJson, отправленный в AI" value={sentLayout ? JSON.stringify(sentLayout, null, 2) : "—"} />
            <DebugCode label="Полученный updatedLayoutJson" value={receivedLayout ? JSON.stringify(receivedLayout, null, 2) : "—"} />
            {artifacts ? <>
              <DebugCode label="Layout JSON версии" value={prettyJson(artifacts.layoutJson)} />
              <DebugCode label="HTML Layout" value={artifacts.htmlLayout || "—"} />
              <DebugCode label="Flutter Tree" value={artifacts.flutterWidgetTree || "—"} />
              <DebugCode label="Промпт для изображения" value={artifacts.imagePrompt || "—"} />
            </> : null}
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <DebugField label="Распознанное намерение" value={String(parsed?.detectedEditIntent ?? "—")} />
              <DebugField label="ID выбранного элемента" value={String(parsed?.selectedElementId ?? "—")} />
              <DebugField label="Ошибки проверки" value={Array.isArray(parsed?.validationErrors) ? parsed.validationErrors.join(", ") || "нет" : "—"} error={Boolean(parsed?.validationErrors?.length)} />
            </dl>
          </section>
        </div>
      ) : null}
    </>
  );
}

function safeParse(value: string | null) {
  try { return value ? JSON.parse(value) as Record<string, any> : null; } catch { return null; }
}

function prettyJson(value: string | null) {
  if (!value) return "—";
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}

function findLayout(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  if ("viewport" in (value as Record<string, unknown>) && "elements" in (value as Record<string, unknown>)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = findLayout(child);
    if (found) return found;
  }
  return null;
}

function DebugField({ label, value, wide = false, error = false }: { label: string; value: string; wide?: boolean; error?: boolean }) {
  return <div className={`rounded-2xl border border-line p-4 ${wide ? "sm:col-span-2" : ""}`}><dt className="text-xs font-black uppercase tracking-[0.1em] text-muted">{label}</dt><dd className={`mt-2 text-sm leading-6 ${error ? "font-bold text-red-600" : "text-ink"}`}>{value}</dd></div>;
}

function DebugCode({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return <div className="mt-4 rounded-2xl border border-line bg-[#fafaff] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-muted">{label}</p>{onCopy ? <button onClick={onCopy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-violet">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Скопировано" : "Копировать"}</button> : null}</div><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink">{value}</pre></div>;
}
