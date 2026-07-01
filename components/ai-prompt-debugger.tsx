"use client";

import { Check, Copy, FileCode2, X } from "lucide-react";
import { useMemo, useState } from "react";

export type PromptLogView = {
  id: string;
  action: string;
  model: string;
  provider?: string;
  requestPreview: string;
  fullPrompt: string;
  rawResponse: string | null;
  parsedResponse: string | null;
  error: string | null;
  finishReason?: string | null;
  tokensJson?: string | null;
  createdAt: string;
};

export function AiPromptDebugger({
  log,
  label = "Показать AI Debug",
  artifacts,
}: {
  log: PromptLogView;
  label?: string;
  artifacts?: { layoutJson: string | null; htmlLayout: string | null; flutterWidgetTree: string | null; imagePrompt: string };
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const parsedResponse = useMemo(() => safeParse(log.parsedResponse), [log.parsedResponse]);
  const promptMessages = useMemo(() => parsePromptMessages(log.fullPrompt), [log.fullPrompt]);
  const sentLayout = findLayout(promptMessages);
  const receivedLayout = parsedResponse?.updatedLayoutJson ?? parsedResponse?.layoutJson ?? parsedResponse?.parsedJson?.layoutJson ?? null;
  const validation = normalizeValidation(parsedResponse);
  const layoutEngine = parsedResponse?.internalDesignModel?.layoutEngine ??
    parsedResponse?.parsedJson?.internalDesignModel?.layoutEngine ??
    parsedResponse?.parsedJson?.layoutEngine ??
    null;

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-bold text-violet hover:border-violet/30"
      >
        <FileCode2 size={15} /> {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="AI Debug">
          <button className="absolute inset-0 cursor-default" aria-label="Закрыть" onClick={() => setOpen(false)} />
          <section className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-violet">AI Debug</p>
                <h2 className="mt-2 text-2xl font-black">{log.action}</h2>
                <p className="mt-1 text-sm text-muted">Здесь сохранены все этапы AI-вызова: промпт, контекст, RAW ответ, восстановленный JSON и проверка.</p>
              </div>
              <button aria-label="Закрыть AI Debug" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-xl border border-line">
                <X size={18} />
              </button>
            </div>

            <dl className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DebugField label="Действие" value={log.action} />
              <DebugField label="Модель" value={log.model} />
              <DebugField label="Провайдер" value={log.provider || modelProvider(log.model)} />
              <DebugField label="Finish reason" value={log.finishReason || "—"} />
              <DebugField label="Создан" value={new Date(log.createdAt).toLocaleString("ru-RU")} />
              <DebugField label="Ошибка" value={log.error || "нет"} error={Boolean(log.error)} />
              <DebugField label="Предпросмотр запроса" value={log.requestPreview || "—"} wide />
            </dl>

            <section className="mt-5 rounded-2xl border border-line bg-[#fafaff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted">JSON Validator</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {validation.map((item) => (
                  <div key={item.label} className={`rounded-xl border px-3 py-2 text-sm ${item.ok ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"}`}>
                    <span className="font-black">{item.ok ? "✓" : "!"} {item.label}</span>
                    <p className="mt-1 text-xs opacity-80">{item.message}</p>
                  </div>
                ))}
              </div>
            </section>

            <DebugCode label="System Prompt" value={promptMessages.system || "—"} onCopy={() => copy(promptMessages.system, "system")} copied={copied === "system"} />
            <DebugCode label="Context" value={promptMessages.context || "—"} onCopy={() => copy(promptMessages.context, "context")} copied={copied === "context"} />
            <DebugCode label="Final Prompt" value={promptMessages.final || log.fullPrompt} onCopy={() => copy(promptMessages.final || log.fullPrompt, "final")} copied={copied === "final"} />
            <DebugCode label="Full Prompt" value={log.fullPrompt} onCopy={() => copy(log.fullPrompt, "prompt")} copied={copied === "prompt"} />
            <DebugCode label="Raw Response" value={log.rawResponse || "—"} onCopy={() => copy(log.rawResponse || "", "raw")} copied={copied === "raw"} />
            <DebugCode label="Parsed JSON" value={prettyJson(log.parsedResponse)} onCopy={() => copy(prettyJson(log.parsedResponse), "parsed")} copied={copied === "parsed"} />
            <DebugCode label="Tokens" value={prettyJson(log.tokensJson ?? null)} />
            <DebugCode label="layoutJson, отправленный в AI" value={sentLayout ? JSON.stringify(sentLayout, null, 2) : "—"} />
            <DebugCode label="updatedLayoutJson / layoutJson, полученный от AI" value={receivedLayout ? JSON.stringify(receivedLayout, null, 2) : "—"} />
            <DebugCode label="Layout Engine · input composition" value={layoutEngine ? JSON.stringify(layoutEngine.entries?.map((entry: any) => ({ elementId: entry.elementId, composition: entry.composition })), null, 2) : "—"} />
            <DebugCode label="Layout Engine · resolved layout" value={layoutEngine ? JSON.stringify(layoutEngine.entries?.map((entry: any) => ({ elementId: entry.elementId, layout: entry.resolvedLayout })), null, 2) : "—"} />
            <DebugCode label="Viewport Normalization" value={layoutEngine ? JSON.stringify(layoutEngine.entries?.map((entry: any) => ({
              elementId: entry.elementId,
              changes: entry.normalizationChanges ?? [],
              notes: entry.warnings ?? [],
            })), null, 2) : "—"} />
            <DebugCode label="Layout Engine · warnings" value={layoutEngine ? JSON.stringify(layoutEngine.warnings ?? [], null, 2) : "—"} />

            {artifacts ? (
              <>
                <DebugCode label="Layout JSON версии" value={prettyJson(artifacts.layoutJson)} />
                <DebugCode label="HTML Layout" value={artifacts.htmlLayout || "—"} />
                <DebugCode label="Flutter Tree" value={artifacts.flutterWidgetTree || "—"} />
                <DebugCode label="Промпт для изображения" value={artifacts.imagePrompt || "—"} />
              </>
            ) : null}

            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <DebugField label="Намерение правки" value={String(parsedResponse?.detectedEditIntent ?? "—")} />
              <DebugField label="Выбранный элемент" value={String(parsedResponse?.selectedElementId ?? "—")} />
              <DebugField
                label="Ошибки проверки"
                value={Array.isArray(parsedResponse?.validationErrors) ? parsedResponse.validationErrors.join(", ") || "нет" : "—"}
                error={Boolean(parsedResponse?.validationErrors?.length)}
              />
            </dl>
          </section>
        </div>
      ) : null}
    </>
  );
}

function safeParse(value: string | null) {
  try {
    return value ? (JSON.parse(value) as Record<string, any>) : null;
  } catch {
    return null;
  }
}

function prettyJson(value: string | null) {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function parsePromptMessages(fullPrompt: string) {
  try {
    const parsed = JSON.parse(fullPrompt) as unknown;
    if (!Array.isArray(parsed)) return { system: "", context: "", final: fullPrompt, raw: parsed };
    const system = parsed.filter((item) => item?.role === "system").map((item) => String(item.content ?? "")).join("\n\n");
    const users = parsed.filter((item) => item?.role === "user").map((item) => String(item.content ?? ""));
    return {
      system,
      context: users.slice(0, -1).join("\n\n"),
      final: users.at(-1) ?? "",
      raw: parsed,
    };
  } catch {
    return { system: "", context: "", final: fullPrompt, raw: fullPrompt };
  }
}

function normalizeValidation(parsed: Record<string, any> | null) {
  const validation = parsed?.validation ?? parsed?.parsedJson?.validation;
  const fallbackErrors = Array.isArray(parsed?.validationErrors) ? parsed.validationErrors : [];
  const groups = [
    ["Layout", validation?.layout ?? fallbackErrors],
    ["Components", validation?.components ?? []],
    ["Tokens", validation?.tokens ?? []],
    ["Prompt", validation?.prompt ?? []],
    ["Constraints", validation?.constraints ?? []],
    ["Memory", validation?.memory ?? []],
  ] as const;
  return groups.map(([label, errors]) => {
    const list = Array.isArray(errors) ? errors.map(String).filter(Boolean) : [];
    return { label, ok: list.length === 0, message: list.length ? list.join("; ") : "проверка пройдена" };
  });
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

function modelProvider(model: string) {
  return model.includes("/") ? model.split("/")[0] : "openrouter";
}

function DebugField({ label, value, wide = false, error = false }: { label: string; value: string; wide?: boolean; error?: boolean }) {
  return (
    <div className={`rounded-2xl border border-line p-4 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <dt className="text-xs font-black uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className={`mt-2 text-sm leading-6 ${error ? "font-bold text-red-600" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

function DebugCode({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-[#fafaff] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-muted">{label}</p>
        {onCopy ? (
          <button onClick={onCopy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-violet">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Скопировано" : "Копировать"}
          </button>
        ) : null}
      </div>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-ink">{value}</pre>
    </div>
  );
}
