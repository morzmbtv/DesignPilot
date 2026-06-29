import { ArrowRight, CheckCircle2, Clock3, MonitorSmartphone, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ButtonLink } from "@/components/button";
import { ProjectIcon } from "@/components/project-icon";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    include: {
      screens: { select: { status: true } },
      _count: { select: { screens: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet">Рабочее пространство / Проекты</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">Проекты</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-muted">
            Создавайте и развивайте дизайн-системы мобильных продуктов.
          </p>
        </div>
        <ButtonLink href="/projects/new" className="h-12 self-start px-6 sm:self-auto">
          <Plus size={18} /> Создать проект
        </ButtonLink>
      </div>

      <section className="mt-10 grid gap-5 md:grid-cols-2 2xl:grid-cols-3" aria-label="Список проектов">
        {projects.length ? (
          projects.map((project) => {
            const approved = project.screens.filter((screen) => screen.status === "approved").length;
            const draft = project._count.screens - approved;
            return (
              <article key={project.id} className="lift flex min-h-[370px] flex-col rounded-[20px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(17,19,38,0.02)] hover:border-violet/30 hover:shadow-soft sm:p-6">
                <div className="flex min-w-0 items-start gap-4">
                  <ProjectIcon name={project.name} />
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black tracking-[-0.025em] text-ink">{project.name}</h2>
                    <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
                      {project.description || "Описание проекта пока не добавлено."}
                    </p>
                  </div>
                </div>
                <div className="my-6 h-px bg-line" />
                <dl className="space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-muted"><MonitorSmartphone size={17} /> Платформа</dt>
                    <dd className="max-w-[55%] truncate font-bold text-ink">{project.platform}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-muted"><CheckCircle2 size={17} /> Экраны</dt>
                    <dd className="font-bold text-ink">{project._count.screens}</dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <dt className="text-muted">Статус</dt>
                    <dd className="flex gap-2">
                      {draft > 0 ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{draft} черновик</span> : null}
                      {approved > 0 ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{approved} утверждено</span> : null}
                      {!draft && !approved ? <span className="text-xs font-bold text-muted">Нет экранов</span> : null}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="flex items-center gap-2 text-muted"><Clock3 size={17} /> Обновлён</dt>
                    <dd className="font-medium text-ink">{dateFormatter.format(project.updatedAt)}</dd>
                  </div>
                </dl>
                <Link
                  href={`/projects/${project.id}`}
                  className="group mt-auto flex items-center justify-between border-t border-line pt-5 text-sm font-black text-violet"
                >
                  Открыть проект
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </article>
            );
          })
        ) : (
          <div className="col-span-full rounded-[20px] border border-dashed border-line bg-white py-16 text-center">
            <p className="text-lg font-bold">Здесь появятся ваши проекты</p>
            <p className="mt-2 text-sm text-muted">Начните с идеи мобильного приложения.</p>
          </div>
        )}
        <Link
          href="/projects/new"
          className="lift flex min-h-[370px] flex-col items-center justify-center rounded-[20px] border border-dashed border-violet/30 bg-violet/[0.025] p-6 text-center hover:border-violet/60"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><Plus size={22} /></span>
          <span className="mt-4 text-lg font-black text-violet">Новый проект</span>
          <span className="mt-1 max-w-[220px] text-sm leading-5 text-muted">Начните с чистого листа и соберите контекст продукта</span>
        </Link>
      </section>

    </AppShell>
  );
}
