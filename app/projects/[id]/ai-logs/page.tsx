import { ArrowLeft, FileCode2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiPromptDebugger } from "@/components/ai-prompt-debugger";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { ModeOnly } from "@/components/interface-mode";
import { requireUser } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function AiLogsPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      aiPromptLogs: {
        include: {
          screen: { select: { name: true } },
          screenVersion: { select: { versionNumber: true, layoutJson: true, htmlLayout: true, flutterWidgetTree: true, imagePrompt: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <Link href={`/projects/${project.id}/memory`} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet"><ArrowLeft size={17} /> {project.name}</Link>
      <div className="mt-6 flex items-start gap-4"><span className="flex size-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><FileCode2 size={23} /></span><div><h1 className="text-4xl font-black tracking-[-0.045em]">Журнал AI</h1><p className="mt-2 text-sm text-muted">Полный журнал промптов, ответов, разбора и ошибок.</p></div></div>
      <div className="mt-8 space-y-4">
        {project.aiPromptLogs.length ? project.aiPromptLogs.map((log) => {
          const view = { ...log, createdAt: log.createdAt.toISOString() };
          return <article key={log.id} className="rounded-[20px] border border-line bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{translateAction(log.action)}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${log.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{log.error ? "Ошибка" : "Успешно"}</span></div><p className="mt-2 text-sm text-muted">{log.screen?.name || "Проект"}{log.screenVersion ? ` · Версия ${log.screenVersion.versionNumber}` : ""} · {log.model}</p><p className="mt-1 text-xs text-muted">{log.createdAt.toLocaleString("ru-RU")}</p></div><ModeOnly mode="expert"><AiPromptDebugger log={view} artifacts={log.screenVersion ? { layoutJson: log.screenVersion.layoutJson, htmlLayout: log.screenVersion.htmlLayout, flutterWidgetTree: log.screenVersion.flutterWidgetTree, imagePrompt: log.screenVersion.imagePrompt } : undefined} /></ModeOnly></div></article>;
        }) : <div className="rounded-[20px] border border-dashed border-line bg-white py-14 text-center text-sm text-muted">AI-вызовов пока нет.</div>}
      </div>
    </AppShell>
  );
}

function translateAction(action: string) {
  return ({ generate_screen: "Генерация экрана", edit_screen: "Изменение экрана", summarize_screen: "Создание сводки", extract_decisions: "Анализ решений", test_openrouter: "Проверка модели" } as Record<string, string>)[action] || action;
}
