"use client";

import { Check, Copy, Pencil, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveScreenVersion } from "@/app/projects/[id]/screens/[screenId]/approval-actions";
import { useInterfaceMode } from "@/components/interface-mode";

export function ScreenActionBar({ projectId, screenId, versionId, imagePrompt, approved }: { projectId: string; screenId: string; versionId: string | null; imagePrompt: string; approved: boolean }) {
  const router = useRouter();
  const { mode } = useInterfaceMode();
  const [message, setMessage] = useState("");
  async function copy() {
    if (!imagePrompt) return setMessage("Сначала сгенерируйте версию экрана.");
    await navigator.clipboard.writeText(imagePrompt);
    setMessage("Промпт скопирован.");
  }
  async function approve() {
    if (!versionId) return setMessage("Сначала сгенерируйте версию экрана.");
    const result = await approveScreenVersion(projectId, screenId, versionId);
    setMessage(result.ok ? "Версия утверждена." : result.error);
    if (result.ok) router.refresh();
  }
  return <div className="mt-6"><div className={`grid gap-2 sm:grid-cols-2 ${mode === "expert" ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}><a href="#generate" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white"><Sparkles size={17} /> Сгенерировать</a><a href="#edit" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-bold"><Pencil size={17} /> Изменить</a>{mode === "expert" ? <button onClick={copy} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white"><Copy size={17} /> Скопировать промпт</button> : null}<button onClick={approve} disabled={approved} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-violet px-5 text-sm font-bold text-violet disabled:border-emerald-200 disabled:bg-emerald-50 disabled:text-emerald-700"><Check size={17} /> {approved ? "Утверждено" : "Утвердить"}</button></div>{message ? <p className="mt-3 text-sm font-bold text-violet">{message}</p> : null}</div>;
}
