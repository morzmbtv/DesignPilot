"use client";

import { Check, Copy, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateScreenWithAI,
  repairAiLogJson,
  retryAiLogJson,
  type GenerateScreenResult,
} from "@/app/projects/[id]/screens/[screenId]/ai-actions";
import { AiContextViewer } from "@/components/ai-context-viewer";
import { ModeOnly } from "@/components/interface-mode";

type SuccessResult = Extract<GenerateScreenResult, { ok: true }>;
type FailureResult = Extract<GenerateScreenResult, { ok: false }>;

export function AiGeneratePanel({
  projectId,
  screenId,
  projectName,
  screenName,
}: {
  projectId: string;
  screenId: string;
  projectName: string;
  screenName: string;
}) {
  const router = useRouter();
  const [request, setRequest] = useState(`Создай экран ${screenName} для ${projectName}`);
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [failure, setFailure] = useState<FailureResult | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFailure(null);
    setCopied(false);
    setIsGenerating(true);
    try {
      const response = await generateScreenWithAI(projectId, screenId, request);
      if (!response.ok) {
        setFailure(response);
        setError(response.error);
        return;
      }
      setResult(response);
      router.refresh();
    } catch {
      setError("Не удалось выполнить генерацию.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyPrompt() {
    if (!result?.imagePrompt) return;
    try {
      await navigator.clipboard.writeText(result.imagePrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError("Не удалось скопировать промпт.");
    }
  }

  async function fixJsonLocally() {
    if (!failure?.logId) return;
    setIsGenerating(true);
    setError("");
    try {
      const response = await repairAiLogJson(projectId, screenId, failure.logId);
      setError(response.ok ? "JSON восстановлен локально и сохранён в AI Log. Проверьте раздел AI Debug." : response.error);
      router.refresh();
    } catch {
      setError("Не удалось локально восстановить JSON.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function retryJson() {
    if (!failure?.logId) return;
    setIsGenerating(true);
    setError("");
    try {
      const response = await retryAiLogJson(projectId, screenId, failure.logId);
      setError(response.ok ? "Повторный запрос выполнен, ответ сохранён в AI Log." : response.error);
      router.refresh();
    } catch {
      setError("Не удалось повторить запрос.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[22px] border border-violet/20 bg-[#faf9ff]">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet text-white shadow-soft">
              <Sparkles size={19} />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-[-0.02em]">Генерация AI</h2>
              <p className="mt-0.5 text-sm text-muted">Создаёт схему экрана и готовый промпт для изображения.</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="mt-6">
            <label className="block text-sm font-black text-ink">
              Запрос
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={4}
                placeholder="Например: Создай экран Dashboard для EDUS Parents App"
                className="mt-2 w-full resize-y rounded-2xl border border-violet/15 bg-white px-4 py-3 text-[15px] leading-6 placeholder:text-muted/60 focus:border-violet"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isGenerating || !request.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {isGenerating ? "Создаём экран и изображения…" : "Сгенерировать"}
              </button>
              <ModeOnly mode="expert"><AiContextViewer projectId={projectId} screenId={screenId} /></ModeOnly>
              <span className="text-xs leading-5 text-muted">
                Результат автоматически сохранится как новая версия.
              </span>
            </div>
          </form>
          {error ? (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <TriangleAlert size={17} className="mt-0.5 shrink-0" /> {error}
            </div>
          ) : null}
          {failure?.recoverable ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-white p-4">
              <p className="text-sm font-black text-red-700">AI Debug</p>
              <div className="mt-3 grid gap-2 text-sm text-ink sm:grid-cols-2">
                <span><strong>Модель:</strong> {failure.model || "неизвестно"}</span>
                <span><strong>Причина:</strong> {failure.parseError || failure.error}</span>
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                {failure.validation ? Object.entries(failure.validation).map(([key, values]) => (
                  <div key={key} className={`rounded-xl px-3 py-2 ${values.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                    <strong>{key}:</strong> {values.length ? values.join("; ") : "✓ прошло"}
                  </div>
                )) : null}
              </div>
              <details className="mt-3 rounded-xl bg-[#fafaff] p-3">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.08em] text-muted">Raw Response</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink">{failure.rawResponse || "Raw response отсутствует."}</pre>
              </details>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={fixJsonLocally} disabled={isGenerating} className="h-10 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-60">Исправить JSON</button>
                <button type="button" onClick={retryJson} disabled={isGenerating} className="h-10 rounded-xl border border-line px-4 text-sm font-bold text-violet disabled:opacity-60">Повторить</button>
              </div>
            </div>
          ) : null}
        </div>

        <ModeOnly mode="expert"><aside className="rounded-2xl bg-ink p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">Контекст генерации</p>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <ContextItem>Память проекта</ContextItem>
            <ContextItem>Правила проекта</ContextItem>
            <ContextItem>Утверждённые экраны</ContextItem>
            <ContextItem>Утверждённые версии экранов</ContextItem>
          </ul>
        </aside></ModeOnly>
      </div>

      {result ? (
        <div className="border-t border-violet/15 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-violet">Версия {result.versionNumber}</p>
              <h3 className="mt-1 text-xl font-black">{result.changeSummary}</h3>
            </div>
            <button
              type="button"
              onClick={copyPrompt}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink hover:border-violet/30 hover:text-violet"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Скопировано" : "Копировать промпт"}
            </button>
          </div>

          {result.warnings.length ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="flex items-center gap-2 font-black"><TriangleAlert size={16} /> Экран создан с предупреждениями</p>
              {result.warnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
            </div>
          ) : result.generatedAssetIds.length ? (
            <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              Создано изображений: {result.generatedAssetIds.length}. Они сохранены в библиотеке ассетов и привязаны к Canvas.
            </p>
          ) : null}

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <ModeOnly mode="expert"><ResultBlock title="Спецификация дизайна" value={result.designSpec} /></ModeOnly>
            <ResultBlock title="Промпт для изображения" value={result.imagePrompt} mono />
          </div>

          {result.newRules.length ? (
            <div className="mt-5 rounded-2xl border border-line bg-[#fafaff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted">Предложенные новые правила</p>
              <div className="mt-3 space-y-2">
                {result.newRules.map((rule, index) => (
                  <div key={`${rule.category}-${rule.name}-${index}`} className="grid gap-1 text-sm sm:grid-cols-[120px_180px_1fr]">
                    <span className="font-bold text-violet">{rule.category}</span>
                    <span className="font-bold">{rule.name}</span>
                    <span className="text-muted">{rule.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ContextItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400 text-ink">
        <Check size={13} strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}

function ResultBlock({ title, value, mono = false }: { title: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line p-5">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-muted">{title}</p>
      <p className={`mt-3 max-h-[520px] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-ink ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
