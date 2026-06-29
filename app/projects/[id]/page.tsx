import { ArrowRight, BookOpen, CheckCircle2, Library, MonitorSmartphone, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      screens: { orderBy: { updatedAt: "desc" }, select: { id: true, name: true, status: true } },
      _count: { select: { screens: true, rules: true, designComponents: true } },
    },
  });
  if (!project) notFound();
  const approved = project.screens.filter((screen) => screen.status === "approved").length;
  const drafts = project._count.screens - approved;
  const latest = project.screens[0];
  const memoryReady = Boolean(project.description && project.appGoal && project.styleDirection);
  const steps = [
    { done: memoryReady, title: "Заполните память проекта", text: "Опишите цель, аудиторию и визуальный стиль.", href: `/projects/${project.id}/memory` },
    { done: project._count.screens > 0, title: "Создайте первый экран", text: "Начните со Splash или Onboarding.", href: `/projects/${project.id}/screens` },
    { done: approved > 0, title: "Проверьте схему", text: "Поправьте расположение элементов перед копированием.", href: latest ? `/projects/${project.id}/screens/${latest.id}` : `/projects/${project.id}/screens` },
    { done: false, title: "Скопируйте промпт", text: "Вставьте его в генерацию изображений ChatGPT.", href: latest ? `/projects/${project.id}/screens/${latest.id}` : `/projects/${project.id}/screens` },
    { done: approved > 0, title: "Утвердите удачную версию", text: "Она станет ориентиром для следующих экранов.", href: latest ? `/projects/${project.id}/screens/${latest.id}` : `/projects/${project.id}/screens` },
  ];

  return <AppShell projectId={project.id} projectName={project.name}>
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-4xl font-black tracking-[-0.045em] sm:text-5xl">{project.name}</h1><p className="mt-3 max-w-2xl text-[15px] leading-6 text-muted">{project.description || "Добавьте описание проекта, чтобы генерации точнее соответствовали вашей идее."}</p></div><Link href={`/projects/${project.id}/screens`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white"><Plus size={17} /> Новый экран</Link></div>
    <section className="mt-9 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[["Экранов", project._count.screens], ["Утверждено", approved], ["Черновиков", drafts], ["Компонентов", project._count.designComponents], ["Правил", project._count.rules]].map(([label, value]) => <div key={label} className="rounded-2xl border border-line bg-white p-5"><p className="text-sm font-bold text-muted">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}
    </section>
    <div className="mt-7 grid gap-7 xl:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-[22px] border border-line bg-white p-6"><h2 className="text-xl font-black">С чего продолжить</h2><div className="mt-5 divide-y divide-line">{steps.map((step, index) => <Link key={step.title} href={step.href} className="group flex items-start gap-4 py-4 first:pt-0 last:pb-0"><span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${step.done ? "bg-emerald-500 text-white" : "bg-violet/10 text-violet"}`}>{step.done ? <CheckCircle2 size={17} /> : index + 1}</span><span className="min-w-0 flex-1"><strong className="block text-sm">{step.title}</strong><span className="mt-1 block text-sm text-muted">{step.text}</span></span><ArrowRight size={17} className="mt-1 text-muted transition-transform group-hover:translate-x-1" /></Link>)}</div></section>
      <section><h2 className="text-xl font-black">Быстрые действия</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Quick href={`/projects/${project.id}/memory`} icon={<BookOpen size={19} />} title="Память проекта" text="Стиль и требования" />
        {latest ? <Quick href={`/projects/${project.id}/screens/${latest.id}`} icon={<MonitorSmartphone size={19} />} title="Последний экран" text={latest.name} /> : <Quick href={`/projects/${project.id}/screens`} icon={<MonitorSmartphone size={19} />} title="Создать Splash" text="Первый экран проекта" />}
        <Quick href={`/projects/${project.id}/library`} icon={<Library size={19} />} title="Библиотека дизайна" text="Компоненты и токены" />
        <Quick href={`/projects/${project.id}/memory#project-rules`} icon={<ShieldCheck size={19} />} title="Правила проекта" text={`${project._count.rules} правил`} />
      </div></section>
    </div>
  </AppShell>;
}

function Quick({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return <Link href={href} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 hover:border-violet/30"><span className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">{icon}</span><span><strong className="block text-sm">{title}</strong><span className="mt-0.5 block text-xs text-muted">{text}</span></span></Link>;
}
