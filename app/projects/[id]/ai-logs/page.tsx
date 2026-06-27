import { ArrowLeft, FileCode2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiPromptDebugger } from "@/components/ai-prompt-debugger";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AiLogsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      aiPromptLogs: {
        include: { screen: { select: { name: true } }, screenVersion: { select: { versionNumber: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <Link href={`/projects/${project.id}/memory`} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet"><ArrowLeft size={17} /> {project.name}</Link>
      <div className="mt-6 flex items-start gap-4"><span className="flex size-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><FileCode2 size={23} /></span><div><h1 className="text-4xl font-black tracking-[-0.045em]">AI Logs</h1><p className="mt-2 text-sm text-muted">Полный журнал prompt, response, parsing и ошибок.</p></div></div>
      <div className="mt-8 space-y-4">
        {project.aiPromptLogs.length ? project.aiPromptLogs.map((log) => {
          const view = { ...log, createdAt: log.createdAt.toISOString() };
          return <article key={log.id} className="rounded-[20px] border border-line bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{log.action}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${log.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{log.error ? "Error" : "Success"}</span></div><p className="mt-2 text-sm text-muted">{log.screen?.name || "Project"}{log.screenVersion ? ` · Version ${log.screenVersion.versionNumber}` : ""} · {log.model}</p><p className="mt-1 text-xs text-muted">{log.createdAt.toLocaleString("ru-RU")}</p></div><AiPromptDebugger log={view} /></div></article>;
        }) : <div className="rounded-[20px] border border-dashed border-line bg-white py-14 text-center text-sm text-muted">AI-вызовов пока нет.</div>}
      </div>
    </AppShell>
  );
}
