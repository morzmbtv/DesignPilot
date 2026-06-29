"use client";

import { CheckCircle2, Loader2, Send, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { testOpenRouter } from "@/app/settings/openrouter/actions";

type Result =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; text: string }
  | { status: "error"; text: string };

export function OpenRouterTestForm({
  defaultModel,
  isKeyConfigured,
}: {
  defaultModel: string;
  isKeyConfigured: boolean;
}) {
  const [model, setModel] = useState(defaultModel);
  const [result, setResult] = useState<Result>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ status: "loading" });
    const response = await testOpenRouter(model);
    setResult(response.ok
      ? { status: "success", text: response.text }
      : { status: "error", text: response.error });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={handleSubmit} className="rounded-[22px] border border-line bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Тестовый запрос</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Проверяет ключ, модель и доступность Chat Completions API.</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isKeyConfigured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {isKeyConfigured ? "Ключ настроен" : "Ключ не настроен"}
          </span>
        </div>

        <label className="mt-8 block text-sm font-black text-ink">
          Model
          <span className="ml-2 text-xs font-normal text-muted">OpenRouter model slug</span>
          <input
            name="model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="openai/gpt-4o-mini"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 h-12 w-full rounded-xl border border-line bg-[#fcfcfe] px-4 font-mono text-sm focus:border-violet focus:bg-white"
          />
        </label>

        <button
          type="submit"
          disabled={result.status === "loading" || !model.trim()}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {result.status === "loading" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          {result.status === "loading" ? "Отправляем…" : "Тестовый запрос"}
        </button>
      </form>

      <section className="min-h-64 rounded-[22px] bg-ink p-6 text-white" aria-live="polite">
        <p className="text-xs font-black uppercase tracking-[0.13em] text-white/45">Ответ модели</p>
        {result.status === "idle" ? (
          <p className="mt-5 text-sm leading-6 text-white/60">Ответ модели появится здесь после тестового запроса.</p>
        ) : null}
        {result.status === "loading" ? (
          <div className="mt-5 flex items-center gap-3 text-sm text-white/70">
            <Loader2 size={18} className="animate-spin text-violet" /> Ожидаем ответ OpenRouter
          </div>
        ) : null}
        {result.status === "success" ? (
          <div className="mt-5">
            <CheckCircle2 size={21} className="text-emerald-400" />
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85">{result.text}</p>
          </div>
        ) : null}
        {result.status === "error" ? (
          <div className="mt-5">
            <TriangleAlert size={21} className="text-amber-400" />
            <p className="mt-3 text-sm leading-6 text-white/80">{result.text}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
