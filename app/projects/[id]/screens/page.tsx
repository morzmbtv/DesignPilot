import { ArrowLeft, ArrowRight, Clock3, Layers3, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProjectTabs } from "@/components/project-tabs";
import { createScreen } from "@/app/actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });

export default async function ScreensPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      screens: {
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  const create = createScreen.bind(null, project.id);

  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet">
        <ArrowLeft size={17} /> Все проекты
      </Link>
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet">{project.name} / Screens</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Screens</h1>
          <p className="mt-2 text-sm text-muted">Создавайте, проверяйте и утверждайте дизайн экранов.</p>
        </div>
      </div>
      <ProjectTabs id={project.id} active="screens" />

      <div className="mt-8 grid gap-8 2xl:grid-cols-[1fr_340px]">
        <section className="grid content-start gap-5 md:grid-cols-2">
          {project.screens.length ? project.screens.map((screen) => {
            const latest = screen.versions[0];
            return (
            <article key={screen.id} className="lift flex min-h-[290px] flex-col rounded-[20px] border border-line bg-white p-5 hover:border-violet/30 hover:shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-[#fafaff] text-violet"><Layers3 size={20} /></span>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black text-ink">{screen.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{screen.purpose || "Назначение пока не добавлено"}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${screen.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {screen.status === "approved" ? "Approved" : "Draft"}
                </span>
              </div>
              <div className="mt-5 rounded-2xl border border-line bg-[#fafaff] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-violet">Latest version</p>
                  <span className="text-xs font-bold text-muted">{screen._count.versions} всего</span>
                </div>
                {latest ? (
                  <>
                    <p className="mt-3 font-black text-ink">Version {latest.versionNumber}</p>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted">{latest.changeSummary || "Версия сохранена без описания изменений."}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={13} /> {dateFormatter.format(latest.createdAt)}</p>
                  </>
                ) : <p className="mt-3 text-sm text-muted">Версий пока нет.</p>}
              </div>
              <Link href={`/projects/${project.id}/screens/${screen.id}`} className="group mt-auto flex items-center justify-between border-t border-line pt-4 text-sm font-black text-violet">
                Открыть экран <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </article>
          );}) : (
            <div className="col-span-full rounded-[20px] border border-dashed border-line bg-white py-14 text-center">
              <Layers3 className="mx-auto text-violet" size={32} />
              <p className="mt-4 font-bold">Добавьте первый экран</p>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-[20px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(17,19,38,0.02)] 2xl:sticky 2xl:top-10">
          <span className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet"><Plus size={19} /></span>
          <h2 className="mt-4 text-xl font-black">Новый экран</h2>
          <p className="mt-1 text-sm leading-5 text-muted">После создания откроется карточка экрана.</p>
          <form action={create} className="mt-5 space-y-4">
            <label className="block text-xs font-bold text-muted">
              Название
              <input name="name" required placeholder="Например, Онбординг" className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink" />
            </label>
            <label className="block text-xs font-bold text-muted">
              Назначение
              <textarea name="purpose" rows={3} placeholder="Что видит и делает пользователь?" className="mt-2 w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm leading-5 text-ink" />
            </label>
            <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet text-sm font-bold text-white hover:bg-[#4e30df]">
              <Plus size={16} /> Создать экран
            </button>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
