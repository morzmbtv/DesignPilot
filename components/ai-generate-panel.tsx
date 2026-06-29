"use client";

import { Check, Copy, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateScreenWithAI,
  type GenerateScreenResult,
} from "@/app/projects/[id]/screens/[screenId]/ai-actions";
import { AiContextViewer } from "@/components/ai-context-viewer";
import { ModeOnly } from "@/components/interface-mode";

type SuccessResult = Extract<GenerateScreenResult, { ok: true }>;

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
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied(false);
    setIsGenerating(true);
    try {
      const response = await generateScreenWithAI(projectId, screenId, request);
      if (!response.ok) {
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
                {isGenerating ? "Генерируем…" : "Сгенерировать"}
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
