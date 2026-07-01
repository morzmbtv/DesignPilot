"use client";

import { Check, FileDiff, Loader2, Plus, Sparkles, TriangleAlert } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  editCurrentScreenVersion,
  checkLockedEditIntent,
  repairEditAiLogJson,
  retryEditAiLogJson,
  saveSuggestedProjectRule,
  type EditScreenVersionResult,
  type SuggestedRule,
} from "@/app/projects/[id]/screens/[screenId]/edit-actions";
import { AiContextViewer } from "@/components/ai-context-viewer";
import { ModeOnly } from "@/components/interface-mode";

type SuccessResult = Extract<EditScreenVersionResult, { ok: true }>;
type FailureResult = Extract<EditScreenVersionResult, { ok: false }>;

export function EditCurrentVersionPanel({
  projectId,
  screenId,
  currentVersionNumber,
}: {
  projectId: string;
  screenId: string;
  currentVersionNumber: number | null;
}) {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [result, setResult] = useState<SuccessResult | null>(null);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [savedRules, setSavedRules] = useState<string[]>([]);
  const [failure, setFailure] = useState<FailureResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSavedRules([]);
    setFailure(null);
    try {
      const lockCheck = await checkLockedEditIntent(projectId, screenId, request);
      const unlockConfirmed = lockCheck.requiresConfirmation
        ? window.confirm(`Элемент заблокирован. Разблокировать и изменить?\n\n${lockCheck.elements.join(", ")}`)
        : false;
      if (lockCheck.requiresConfirmation && !unlockConfirmed) return;
      setIsEditing(true);
      let response = await editCurrentScreenVersion(projectId, screenId, request, undefined, unlockConfirmed);
      if (!response.ok && response.deletionConfirmation?.length) {
        const confirmed = window.confirm(
          `Элемент был удалён AI.\n\n${response.deletionConfirmation.map((item) => `• ${item.name} (${item.id})`).join("\n")}\n\nПодтвердить удаление?`,
        );
        if (!confirmed) {
          setError("Удаление отменено. Исходные элементы сохранены.");
          return;
        }
        response = await editCurrentScreenVersion(projectId, screenId, request, undefined, unlockConfirmed, true);
      }
      if (!response.ok) {
        setError(response.error);
        if (response.recoverable) setFailure(response);
        return;
      }
      setResult(response);
      setRequest("");
      router.refresh();
    } catch {
      setError("Не удалось отправить правку.");
    } finally {
      setIsEditing(false);
    }
  }

  async function fixJsonLocally() {
    if (!failure?.logId) return;
    setError("");
    const response = await repairEditAiLogJson(projectId, screenId, failure.logId);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setError("JSON восстановлен локально и сохранён в AI Log. Откройте журнал AI Debug, чтобы проверить результат.");
    router.refresh();
  }

  async function retryJson() {
    if (!failure?.logId) return;
    setError("");
    const response = await retryEditAiLogJson(projectId, screenId, failure.logId);
    if (!response.ok) {
      setError(response.error);
      return;
    }
    setError("Повторный ответ получен и сохранён в AI Log. Проверьте результат в AI Debug.");
    router.refresh();
  }

  async function saveRule(rule: SuggestedRule, key: string) {
    setSavingRule(key);
    setError("");
    try {
      const response = await saveSuggestedProjectRule(projectId, rule);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setSavedRules((current) => [...current, key]);
    } catch {
      setError("Не удалось сохранить правило.");
    } finally {
      setSavingRule(null);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[22px] border border-coral/20 bg-[#fffaf8]">
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-coral text-white">
              <FileDiff size={19} />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-[-0.02em]">Изменить текущую версию</h2>
              <p className="mt-0.5 text-sm text-muted">
                {currentVersionNumber
                  ? `Точечно изменит версию ${currentVersionNumber} и сохранит новую.`
                  : "Сначала создайте первую версию экрана."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            <label className="block text-sm font-black text-ink">
              Что изменить
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={4}
                disabled={!currentVersionNumber}
                placeholder="Например: Увеличь кнопку Далее на 10 px"
                className="mt-2 w-full resize-y rounded-2xl border border-coral/15 bg-white px-4 py-3 text-[15px] leading-6 placeholder:text-muted/60 focus:border-coral disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
              <Example onClick={setRequest}>Увеличь кнопку Далее на 10 px</Example>
              <Example onClick={setRequest}>Сделай карточки выше</Example>
              <Example onClick={setRequest}>Опусти блок Последние события ниже</Example>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isEditing || !request.trim() || !currentVersionNumber}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {isEditing ? "Применяем правку…" : "Применить правку"}
              </button>
              <ModeOnly mode="expert"><AiContextViewer projectId={projectId} screenId={screenId} /></ModeOnly>
            </div>
          </form>

          {error ? (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <TriangleAlert size={17} className="mt-0.5 shrink-0" /> {error}
            </div>
          ) : null}

          {failure?.recoverable ? (
            <ModeOnly mode="expert"><div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-black">AI Debug: ответ модели сохранён, но JSON требует проверки</p>
              <p className="mt-1">Модель: {failure.model || "неизвестно"}</p>
              <p className="mt-1">Причина: {failure.parseError || failure.error}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {Object.entries(failure.validation ?? {}).map(([key, errors]) => (
                  <div key={key} className={`rounded-xl px-3 py-2 ${errors.length ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    <span className="font-bold">{errors.length ? "!" : "✓"} {key}</span>
                    <p className="mt-1 text-xs">{errors.length ? errors.join("; ") : "проверка пройдена"}</p>
                  </div>
                ))}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer font-bold">Показать RAW ответ</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 font-mono text-xs">{failure.rawResponse || "RAW ответ отсутствует"}</pre>
              </details>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={fixJsonLocally} className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-white">
                  Исправить JSON
                </button>
                <button type="button" onClick={retryJson} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900">
                  Повторить
                </button>
              </div>
            </div></ModeOnly>
          ) : null}
          {failure?.recoverable ? <ModeOnly mode="simple"><p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Правку не удалось применить автоматически. Переключитесь в режим «Разработчик», чтобы открыть диагностику или повторить запрос.</p></ModeOnly> : null}
        </div>

        <ModeOnly mode="expert"><aside className="rounded-2xl border border-coral/15 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-coral">Как будет применена правка</p>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <ContractItem>Только указанная часть</ContractItem>
            <ContractItem>Старую версию не меняем</ContractItem>
            <ContractItem>Правила проекта соблюдаются</ContractItem>
            <ContractItem>Глобальные правки — на подтверждение</ContractItem>
          </ul>
        </aside></ModeOnly>
      </div>

      {result ? (
        <div className="border-t border-coral/15 bg-white p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-coral">Новая версия {result.versionNumber}</p>
          <h3 className="mt-1 text-xl font-black">{result.changeSummary}</h3>

          <div className="mt-5 rounded-2xl border border-coral/20 bg-[#fffaf8] p-5">
            <div className="flex items-center gap-2">
              <FileDiff size={18} className="text-coral" />
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted">Изменения</p>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{result.diff}</p>
          </div>

          <ModeOnly mode="expert"><div className="mt-4 grid gap-3 lg:grid-cols-2">
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer text-sm font-black">Обновлённая спецификация</summary>
              <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-muted">{result.updatedDesignSpec}</p>
            </details>
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer text-sm font-black">Обновлённый промпт</summary>
              <p className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-6 text-muted">{result.updatedImagePrompt}</p>
            </details>
          </div></ModeOnly>

          {result.rulesToAddOrUpdate.length ? (
            <div className="mt-5 rounded-2xl border border-violet/15 bg-violet/[0.025] p-5">
              <h4 className="font-black">Глобальная правка</h4>
              <p className="mt-1 text-sm text-muted">Сохранить её как правило проекта для следующих экранов?</p>
              <div className="mt-4 space-y-3">
                {result.rulesToAddOrUpdate.map((rule, index) => {
                  const key = `${rule.category}-${rule.name}-${index}`;
                  const saved = savedRules.includes(key);
                  return (
                    <div key={key} className="grid gap-3 rounded-xl bg-white p-3 sm:grid-cols-[120px_160px_1fr_auto] sm:items-center">
                      <span className="text-sm font-bold text-violet">{rule.category}</span>
                      <span className="text-sm font-bold">{rule.name}</span>
                      <span className="text-sm text-muted">{rule.value}</span>
                      <button
                        type="button"
                        disabled={saved || savingRule === key}
                        onClick={() => saveRule(rule, key)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-violet px-3 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {savingRule === key ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Plus size={14} />}
                        {saved ? "Сохранено" : "Сохранить как правило"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Example({ children, onClick }: { children: string; onClick: (value: string) => void }) {
  return (
    <button type="button" onClick={() => onClick(children)} className="rounded-lg border border-coral/15 bg-white px-2.5 py-1.5 hover:border-coral/40 hover:text-ink">
      {children}
    </button>
  );
}

function ContractItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={15} className="mt-0.5 shrink-0 text-coral" />
      {children}
    </li>
  );
}
