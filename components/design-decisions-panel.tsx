"use client";

import { Check, Filter, Loader2, Scale, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { analyzeProjectRuleImpact } from "@/app/actions";
import { promoteDecisionToRule, setDecisionStatus } from "@/app/projects/[id]/decisions/actions";

type Decision = {
  id: string;
  type: string;
  target: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  source: string;
  status: string;
  createdAt: string;
  screen: { id: string; name: string } | null;
};

type Impact = Awaited<ReturnType<typeof analyzeProjectRuleImpact>>;

export function DesignDecisionsPanel({ projectId, decisions }: { projectId: string; decisions: Decision[] }) {
  const [items, setItems] = useState(decisions);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [screen, setScreen] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ decision: Decision; impact: Impact } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => items.filter((item) =>
    (status === "all" || item.status === status) &&
    (type === "all" || item.type === type) &&
    (screen === "all" || item.screen?.id === screen)
  ), [items, screen, status, type]);
  const types = Array.from(new Set(items.map((item) => item.type)));
  const screens = Array.from(new Map(items.flatMap((item) => item.screen ? [[item.screen.id, item.screen.name] as const] : [])).entries());

  async function changeStatus(id: string, next: "approved" | "rejected") {
    setBusy(id);
    const result = await setDecisionStatus(projectId, id, next);
    if (result.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, status: next } : item));
    else setError(result.error);
    setBusy(null);
  }

  async function openPromotion(decision: Decision) {
    setBusy(decision.id);
    const impact = await analyzeProjectRuleImpact(projectId, {
      target: decision.target,
      value: decision.newValue || decision.reason || "",
    });
    setPromotion({ decision, impact });
    setConfirmed(false);
    setBusy(null);
  }

  async function promote() {
    if (!promotion || !confirmed) return;
    setBusy(promotion.decision.id);
    const result = await promoteDecisionToRule(projectId, promotion.decision.id);
    if (result.ok) {
      setItems((current) => current.map((item) => item.id === promotion.decision.id ? { ...item, status: "approved" } : item));
      setPromotion(null);
    } else setError(result.error);
    setBusy(null);
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-3 rounded-2xl border border-line bg-white p-4">
        <Filter size={18} className="mt-3 text-violet" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={["all", "proposed", "approved", "rejected"]} />
        <FilterSelect label="Type" value={type} onChange={setType} options={["all", ...types]} />
        <label className="text-xs font-bold text-muted">Screen
          <select value={screen} onChange={(event) => setScreen(event.target.value)} className="mt-1 block h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink">
            <option value="all">all</option>
            {screens.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
      </div>
      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      <div className="mt-6 space-y-4">
        {visible.length ? visible.map((decision) => (
          <article key={decision.id} className="rounded-[20px] border border-line bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet/10 text-violet"><Scale size={20} /></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black text-ink">{decision.target}</h2>
                    <StatusBadge status={decision.status} />
                    <span className="rounded-full bg-[#f3f3f8] px-2.5 py-1 text-xs font-bold text-muted">{decision.type}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{decision.oldValue || "—"} <span className="px-2 text-violet">→</span> <strong className="text-ink">{decision.newValue || "—"}</strong></p>
                  {decision.reason ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{decision.reason}</p> : null}
                  <p className="mt-3 text-xs text-muted">{decision.screen?.name || "Global"} · {decision.source} · {new Date(decision.createdAt).toLocaleString("ru-RU")}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {decision.status === "proposed" ? (
                  <>
                    <ActionButton onClick={() => changeStatus(decision.id, "approved")} disabled={busy === decision.id}><Check size={14} /> Approve</ActionButton>
                    <ActionButton onClick={() => changeStatus(decision.id, "rejected")} disabled={busy === decision.id} danger><X size={14} /> Reject</ActionButton>
                  </>
                ) : null}
                <ActionButton onClick={() => openPromotion(decision)} disabled={busy === decision.id}><ShieldCheck size={14} /> Promote to Project Rule</ActionButton>
              </div>
            </div>
          </article>
        )) : <div className="rounded-[20px] border border-dashed border-line bg-white py-14 text-center text-sm text-muted">Решений по выбранным фильтрам нет.</div>}
      </div>
      {promotion ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" role="dialog" aria-modal="true" aria-label="Rule impact analysis">
          <button className="absolute inset-0 cursor-default" onClick={() => setPromotion(null)} aria-label="Закрыть" />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-bold text-violet">Rule promotion</p><h2 className="mt-2 text-2xl font-black">Rule impact analysis</h2></div>
              <button onClick={() => setPromotion(null)} className="flex size-10 items-center justify-center rounded-xl border border-line"><X size={18} /></button>
            </div>
            <div className="mt-7 rounded-2xl bg-[#fafaff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-muted">Rule target</p>
              <p className="mt-2 font-black">{promotion.decision.target}</p>
              <p className="mt-1 text-sm text-muted">{promotion.decision.newValue || promotion.decision.reason}</p>
            </div>
            <h3 className="mt-7 font-black">{promotion.impact.count} approved screens potentially affected</h3>
            <div className="mt-4 space-y-3">
              {promotion.impact.affectedScreens.map((screen) => (
                <div key={screen.id} className="rounded-2xl border border-line p-4">
                  <p className="font-black">{screen.name}</p>
                  <p className="mt-1 text-sm leading-5 text-muted">{screen.summary}</p>
                  <p className="mt-2 text-xs font-bold text-violet">{screen.matchedKeywords.join(", ")}</p>
                </div>
              ))}
              {!promotion.impact.count ? <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Совпадений в approved screens не найдено.</p> : null}
            </div>
            <label className="mt-7 flex items-start gap-3 rounded-2xl border border-violet/15 bg-violet/[0.03] p-4 text-sm">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4" />
              Я подтверждаю создание или обновление ProjectRule.
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setPromotion(null)} className="h-11 rounded-xl border border-line px-5 text-sm font-bold">Cancel</button>
              <button onClick={promote} disabled={!confirmed || busy === promotion.decision.id} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white disabled:opacity-50">
                {busy === promotion.decision.id ? <Loader2 size={16} className="animate-spin" /> : null} Promote rule
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="text-xs font-bold text-muted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
function StatusBadge({ status }: { status: string }) {
  const color = status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{status}</span>;
}
function ActionButton({ children, onClick, disabled, danger = false }: { children: React.ReactNode; onClick: () => void; disabled: boolean; danger?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold disabled:opacity-50 ${danger ? "border-red-200 text-red-600" : "border-violet/25 text-violet"}`}>{children}</button>;
}
