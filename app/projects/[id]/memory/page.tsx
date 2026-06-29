import { ArrowLeft, ArrowRight, CheckCircle2, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProjectMemoryEditor } from "@/components/project-memory-editor";
import { ProjectTabs } from "@/components/project-tabs";
import { deleteProject } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { ModeOnly } from "@/components/interface-mode";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export const dynamic = "force-dynamic";

export default async function ProjectMemoryPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      rules: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      screens: {
        where: { status: "approved", approvedVersionId: { not: null } },
        include: {
          approvedVersion: {
            select: { versionNumber: true, changeSummary: true },
          },
          summaries: { orderBy: { updatedAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project) notFound();

  const remove = deleteProject.bind(null, project.id);
  const initialMemory = {
    description: project.description,
    targetUsers: project.targetUsers,
    appGoal: project.appGoal,
    platform: project.platform,
    styleDirection: project.styleDirection,
    designRequirements: project.designRequirements,
    architectureNotes: project.architectureNotes,
    constraints: project.constraints,
  };
  const initialRules = project.rules.map((rule) => ({
    ...rule,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }));

  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet">
        <ArrowLeft size={17} /> Все проекты
      </Link>
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-[-0.045em] sm:text-5xl">{project.name}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-muted">
            Память проекта хранит стиль, цели и требования для всех будущих экранов.
          </p>
        </div>
      </div>
      <ProjectTabs id={project.id} active="memory" />
      <section className="mt-8 rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_1px_2px_rgba(17,19,38,0.02)] sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <h2 className="text-xl font-black">Утверждённые экраны</h2>
            <p className="mt-0.5 text-sm text-muted">Только эти версии используются как источник истины для следующих экранов.</p>
          </div>
        </div>
        {project.screens.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {project.screens.map((screen) => (
              <Link
                key={screen.id}
                href={`/projects/${project.id}/screens/${screen.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-white p-4"
              >
                <span>
                  <span className="block font-black">{screen.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    Версия {screen.approvedVersion?.versionNumber}
                    {screen.approvedVersion?.changeSummary ? ` · ${screen.approvedVersion.changeSummary}` : ""}
                  </span>
                  {screen.summaries[0] ? <span className="mt-2 block text-sm leading-5 text-ink">{screen.summaries[0].summary}</span> : null}
                </span>
                <ArrowRight size={18} className="shrink-0 text-emerald-600 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-white/60 px-4 py-6 text-center text-sm text-muted">
            Утверждённых экранов пока нет.
          </p>
        )}
      </section>
      <ProjectMemoryEditor projectId={project.id} initialMemory={initialMemory} initialRules={initialRules} />
      <ModeOnly mode="expert"><details className="mt-8 rounded-2xl border border-red-100 bg-white p-5"><summary className="cursor-pointer text-sm font-bold text-red-600">Дополнительно</summary><form action={remove} className="mt-4"><ConfirmSubmitButton message={`Удалить проект «${project.name}» вместе со всеми экранами?`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600"><Trash2 size={16} /> Удалить проект</ConfirmSubmitButton></form></details></ModeOnly>
    </AppShell>
  );
}
