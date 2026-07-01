"use client";

import { ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { testOpenRouterImage } from "@/app/settings/openrouter/actions";

export function OpenRouterImageTestForm({ projects, configured }: {
  projects: Array<{ id: string; name: string }>;
  configured: boolean;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  async function run() {
    setLoading(true);
    setResult(null);
    const response = await testOpenRouterImage(projectId);
    setLoading(false);
    setResult({ ok: response.ok, text: response.ok ? response.text : response.error });
  }
  return (
    <section className="mt-6 rounded-[22px] border border-line bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-black"><ImageIcon className="text-violet" /> Тест генерации изображения</h2><p className="mt-1 text-sm text-muted">Создаёт маленький тестовый ассет и сохраняет его в выбранный проект.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{configured ? "Image model настроена" : "Image model не настроена"}</span></div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-11 min-w-64 rounded-xl border border-line bg-white px-3 text-sm"><option value="">Выберите проект</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <button type="button" disabled={!configured || !projectId || loading} onClick={run} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} Тест image generation</button>
      </div>
      {result ? <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{result.text}</p> : null}
    </section>
  );
}
