"use client";

import { Check, CheckCircle2, Loader2, Plus, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { approveScreenVersion } from "@/app/projects/[id]/screens/[screenId]/approval-actions";
import { saveSuggestedProjectRule, type SuggestedRule } from "@/app/projects/[id]/screens/[screenId]/edit-actions";

export function VersionApproval({
  projectId,
  screenId,
  versionId,
  versionNumber,
  isApproved,
  initialRules,
}: {
  projectId: string;
  screenId: string;
  versionId: string;
  versionNumber: number;
  isApproved: boolean;
  initialRules: SuggestedRule[];
}) {
  const router = useRouter();
  const [approved, setApproved] = useState(isApproved);
  const [rules, setRules] = useState(initialRules);
  const [isApproving, setIsApproving] = useState(false);
  const [savingRule, setSavingRule] = useState<string | null>(null);
  const [savedRules, setSavedRules] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setApproved(isApproved);
    setRules(initialRules);
  }, [initialRules, isApproved]);

  async function approve() {
    setIsApproving(true);
    setError("");
    try {
      const response = await approveScreenVersion(projectId, screenId, versionId);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setApproved(true);
      setRules(response.newRules);
      router.refresh();
    } catch {
      setError("Не удалось утвердить версию.");
    } finally {
      setIsApproving(false);
    }
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
    <div className="mt-4 border-t border-line pt-4">
      <button
        type="button"
        onClick={approve}
        disabled={approved || isApproving}
        className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ${
          approved
            ? "bg-emerald-50 text-emerald-700"
            : "bg-violet text-white shadow-soft disabled:opacity-60"
        }`}
      >
        {isApproving ? <Loader2 size={16} className="animate-spin" /> : approved ? <CheckCircle2 size={16} /> : <Check size={16} />}
        {approved ? `Approved version ${versionNumber}` : "Approve version"}
      </button>

      {approved && rules.length ? (
        <div className="mt-4 rounded-xl bg-violet/[0.035] p-4">
          <p className="text-sm font-black">Сохранить новые правила в Project Memory?</p>
          <div className="mt-3 space-y-2">
            {rules.map((rule, index) => {
              const key = `${rule.category}-${rule.name}-${index}`;
              const saved = savedRules.includes(key);
              return (
                <div key={key} className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[110px_150px_1fr_auto] sm:items-center">
                  <span className="text-xs font-bold text-violet">{rule.category}</span>
                  <span className="text-xs font-bold">{rule.name}</span>
                  <span className="text-xs text-muted">{rule.value}</span>
                  <button
                    type="button"
                    disabled={saved || savingRule === key}
                    onClick={() => saveRule(rule, key)}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {savingRule === key ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Plus size={13} />}
                    {saved ? "Сохранено" : "Сохранить"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm font-bold text-red-600">
          <TriangleAlert size={15} /> {error}
        </p>
      ) : null}
    </div>
  );
}
