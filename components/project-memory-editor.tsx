"use client";

import { Check, CheckCircle2, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  addProjectMemoryRule,
  analyzeProjectRuleImpact,
  removeProjectMemoryRule,
  saveProjectMemory,
  updateProjectMemoryRule,
} from "@/app/actions";

type Memory = {
  description: string;
  targetUsers: string;
  appGoal: string;
  platform: string;
  styleDirection: string;
  designRequirements: string;
  architectureNotes: string;
  constraints: string;
};

type Rule = {
  id: string;
  category: string;
  name: string;
  value: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

type RuleDraft = Pick<Rule, "category" | "name" | "value" | "source">;

const emptyRule: RuleDraft = { category: "", name: "", value: "", source: "user" };

export function ProjectMemoryEditor({
  projectId,
  initialMemory,
  initialRules,
}: {
  projectId: string;
  initialMemory: Memory;
  initialRules: Rule[];
}) {
  const [memory, setMemory] = useState(initialMemory);
  const [rules, setRules] = useState(initialRules);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(emptyRule);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<RuleDraft>(emptyRule);
  const [busyRule, setBusyRule] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState("");

  function updateMemory(field: keyof Memory, nextValue: string) {
    setMemory((current) => ({ ...current, [field]: nextValue }));
    setSaveState("dirty");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    try {
      await saveProjectMemory(projectId, memory);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function handleAddRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuleError("");
    setBusyRule("new");
    try {
      const created = await addProjectMemoryRule(projectId, ruleDraft);
      setRules((current) => [...current, created]);
      setRuleDraft(emptyRule);
    } catch (error) {
      setRuleError(error instanceof Error ? error.message : "Не удалось добавить правило");
    } finally {
      setBusyRule(null);
    }
  }

  function startEditing(rule: Rule) {
    setEditingId(rule.id);
    setEditingRule({
      category: rule.category,
      name: rule.name,
      value: rule.value,
      source: rule.source,
    });
    setRuleError("");
  }

  async function handleUpdateRule(ruleId: string) {
    setRuleError("");
    const impact = await analyzeProjectRuleImpact(projectId, editingRule);
    if (impact.count && !window.confirm(
      `Правило потенциально затронет ${impact.count} approved screens:\n${impact.affectedScreens.map((screen) => `• ${screen.name}`).join("\n")}\n\nСохранить изменение?`,
    )) return;
    setBusyRule(ruleId);
    try {
      const updated = await updateProjectMemoryRule(projectId, ruleId, editingRule);
      setRules((current) => current.map((rule) => (rule.id === ruleId ? updated : rule)));
      setEditingId(null);
    } catch (error) {
      setRuleError(error instanceof Error ? error.message : "Не удалось изменить правило");
    } finally {
      setBusyRule(null);
    }
  }

  async function handleDeleteRule(ruleId: string) {
    if (!window.confirm("Удалить это правило?")) return;
    setBusyRule(ruleId);
    setRuleError("");
    try {
      await removeProjectMemoryRule(projectId, ruleId);
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
      if (editingId === ruleId) setEditingId(null);
    } catch {
      setRuleError("Не удалось удалить правило");
    } finally {
      setBusyRule(null);
    }
  }

  return (
    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-8">
        <form onSubmit={handleSave} className="space-y-8">
          <MemorySection
            number="01"
            title="Основы проекта"
            description="Что это за продукт, для кого он создаётся и какой результат должен дать."
          >
            <MemoryField
              label="Описание проекта"
              hint="Короткий продуктовый контекст"
              value={memory.description}
              onChange={(value) => updateMemory("description", value)}
              large
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <MemoryField
                label="Целевая аудитория"
                hint="Потребности, опыт и контекст пользователей"
                value={memory.targetUsers}
                onChange={(value) => updateMemory("targetUsers", value)}
              />
              <MemoryField
                label="Цель приложения"
                hint="Главный пользовательский и бизнес-результат"
                value={memory.appGoal}
                onChange={(value) => updateMemory("appGoal", value)}
              />
            </div>
            <MemoryField
              label="Платформа"
              hint="Например, iOS, Android или обе платформы"
              value={memory.platform}
              onChange={(value) => updateMemory("platform", value)}
              input
            />
          </MemorySection>

          <MemorySection
            number="02"
            title="Дизайн и направление"
            description="Визуальный характер продукта и требования, которым должен следовать интерфейс."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <MemoryField
                label="Стиль"
                hint="Настроение, визуальный язык, референсы"
                value={memory.styleDirection}
                onChange={(value) => updateMemory("styleDirection", value)}
              />
              <MemoryField
                label="Требования к дизайну"
                hint="Сетка, компоненты, доступность и состояния"
                value={memory.designRequirements}
                onChange={(value) => updateMemory("designRequirements", value)}
              />
            </div>
          </MemorySection>

          <MemorySection
            number="03"
            title="Архитектура и рамки"
            description="Структура приложения, ключевые сценарии и ограничения решения."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <MemoryField
                label="Архитектурные заметки"
                hint="Разделы, навигация и пользовательские потоки"
                value={memory.architectureNotes}
                onChange={(value) => updateMemory("architectureNotes", value)}
              />
              <MemoryField
                label="Ограничения"
                hint="Технические, продуктовые и визуальные рамки"
                value={memory.constraints}
                onChange={(value) => updateMemory("constraints", value)}
              />
            </div>
          </MemorySection>

          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-line bg-white/95 p-3 shadow-soft backdrop-blur">
            <SaveStatus state={saveState} />
            <button
              type="submit"
              disabled={saveState === "saving" || saveState === "idle" || saveState === "saved"}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveState === "saving" ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              Сохранить Project Memory
            </button>
          </div>
        </form>

        <section id="project-rules" className="scroll-mt-8 rounded-[22px] border border-line bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet">04 · Rules</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Правила проекта</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                Явные инструкции, которые используются при подготовке Design Spec и промптов.
              </p>
            </div>
            <span className="text-sm font-bold text-muted">{rules.length} правил</span>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[650px]">
              <div className="grid grid-cols-[110px_150px_1fr_90px_72px] gap-3 border-b border-line px-3 pb-3 text-[11px] font-black uppercase tracking-[0.1em] text-muted">
                <span>Category</span><span>Name</span><span>Value</span><span>Source</span><span />
              </div>
              {rules.length ? rules.map((rule) => (
                editingId === rule.id ? (
                  <div key={rule.id} className="grid grid-cols-[110px_150px_1fr_90px_72px] gap-3 border-b border-line bg-violet/[0.025] px-3 py-3">
                    <RuleInput value={editingRule.category} onChange={(value) => setEditingRule((current) => ({ ...current, category: value }))} ariaLabel="Категория правила" />
                    <RuleInput value={editingRule.name} onChange={(value) => setEditingRule((current) => ({ ...current, name: value }))} ariaLabel="Название правила" />
                    <RuleInput value={editingRule.value} onChange={(value) => setEditingRule((current) => ({ ...current, value }))} ariaLabel="Значение правила" />
                    <RuleInput value={editingRule.source} onChange={(value) => setEditingRule((current) => ({ ...current, source: value }))} ariaLabel="Источник правила" />
                    <span className="flex items-center justify-end gap-1">
                      <IconButton label="Сохранить правило" onClick={() => handleUpdateRule(rule.id)} disabled={busyRule === rule.id}>
                        {busyRule === rule.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </IconButton>
                      <IconButton label="Отменить редактирование" onClick={() => setEditingId(null)}><X size={16} /></IconButton>
                    </span>
                  </div>
                ) : (
                  <div key={rule.id} className="group grid grid-cols-[110px_150px_1fr_90px_72px] gap-3 border-b border-line px-3 py-4 text-sm">
                    <span className="font-bold text-violet">{rule.category}</span>
                    <span className="font-bold text-ink">{rule.name}</span>
                    <span className="leading-5 text-muted">{rule.value}</span>
                    <span className="text-muted">{rule.source}</span>
                    <span className="flex items-start justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      <IconButton label={`Изменить правило ${rule.name}`} onClick={() => startEditing(rule)}><Pencil size={15} /></IconButton>
                      <IconButton label={`Удалить правило ${rule.name}`} onClick={() => handleDeleteRule(rule.id)} disabled={busyRule === rule.id} danger>
                        {busyRule === rule.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </IconButton>
                    </span>
                  </div>
                )
              )) : (
                <div className="py-10 text-center text-sm text-muted">Добавьте первое правило проекта.</div>
              )}
            </div>
          </div>

          <form onSubmit={handleAddRule} className="mt-5 grid gap-3 rounded-2xl bg-[#f8f8fc] p-4 sm:grid-cols-2">
            <RuleInput placeholder="Например, Цвет" value={ruleDraft.category} onChange={(value) => setRuleDraft((current) => ({ ...current, category: value }))} ariaLabel="Категория нового правила" />
            <RuleInput placeholder="Название" value={ruleDraft.name} onChange={(value) => setRuleDraft((current) => ({ ...current, name: value }))} ariaLabel="Название нового правила" required />
            <RuleInput placeholder="Значение правила" value={ruleDraft.value} onChange={(value) => setRuleDraft((current) => ({ ...current, value }))} ariaLabel="Значение нового правила" className="sm:col-span-2" required />
            <RuleInput placeholder="Источник" value={ruleDraft.source} onChange={(value) => setRuleDraft((current) => ({ ...current, source: value }))} ariaLabel="Источник нового правила" />
            <button disabled={busyRule === "new"} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-60 sm:justify-self-end">
              {busyRule === "new" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Добавить
            </button>
          </form>
          {ruleError ? <p role="alert" className="mt-3 text-sm font-bold text-red-600">{ruleError}</p> : null}
        </section>
      </div>

      <aside className="order-first xl:order-none">
        <div className="sticky top-6 rounded-[22px] bg-ink p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-white/50">Memory status</p>
          <p className="mt-4 text-lg font-black">Единый источник контекста</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Эти данные будут использоваться для генерации спецификаций каждого экрана.
          </p>
          <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
            <MemoryProgress label="Основы" complete={Boolean(memory.description && memory.targetUsers && memory.appGoal)} />
            <MemoryProgress label="Дизайн" complete={Boolean(memory.styleDirection && memory.designRequirements)} />
            <MemoryProgress label="Архитектура" complete={Boolean(memory.architectureNotes)} />
            <MemoryProgress label="Правила" complete={rules.length > 0} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function MemorySection({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-line bg-white p-5 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet">{number}</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function MemoryField({ label, hint, value, onChange, large = false, input = false }: { label: string; hint: string; value: string; onChange: (value: string) => void; large?: boolean; input?: boolean }) {
  const classes = "mt-2 w-full rounded-2xl border border-line bg-[#fcfcfe] px-4 py-3 text-[15px] leading-6 text-ink transition focus:border-violet focus:bg-white";
  return (
    <label className="block">
      <span className="text-sm font-black text-ink">{label}</span>
      <span className="ml-2 text-xs text-muted">{hint}</span>
      {input ? (
        <input value={value} onChange={(event) => onChange(event.target.value)} className={classes} />
      ) : (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={large ? 6 : 5} className={`${classes} resize-y`} />
      )}
    </label>
  );
}

function SaveStatus({ state }: { state: "idle" | "dirty" | "saving" | "saved" | "error" }) {
  const content = {
    idle: ["Все данные актуальны", "text-muted"],
    dirty: ["Есть несохранённые изменения", "text-amber-700"],
    saving: ["Сохраняем изменения…", "text-muted"],
    saved: ["Изменения сохранены", "text-emerald-700"],
    error: ["Не удалось сохранить", "text-red-600"],
  } as const;
  return (
    <span className={`inline-flex items-center gap-2 px-2 text-sm font-bold ${content[state][1]}`}>
      {state === "saving" ? <Loader2 size={16} className="animate-spin" /> : state === "saved" || state === "idle" ? <CheckCircle2 size={16} /> : null}
      {content[state][0]}
    </span>
  );
}

function RuleInput({ value, onChange, ariaLabel, placeholder, required = false, className = "" }: { value: string; onChange: (value: string) => void; ariaLabel: string; placeholder?: string; required?: boolean; className?: string }) {
  return <input aria-label={ariaLabel} required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`h-10 min-w-0 rounded-xl border border-line bg-white px-3 text-sm ${className}`} />;
}

function IconButton({ label, onClick, children, danger = false, disabled = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={`flex size-8 items-center justify-center rounded-lg hover:bg-white disabled:opacity-40 ${danger ? "text-muted hover:text-red-600" : "text-muted hover:text-violet"}`}>
      {children}
    </button>
  );
}

function MemoryProgress({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/75">{label}</span>
      <span className={`flex size-5 items-center justify-center rounded-full ${complete ? "bg-emerald-400 text-ink" : "border border-white/25 text-white/40"}`}>
        {complete ? <Check size={13} strokeWidth={3} /> : null}
      </span>
    </div>
  );
}
