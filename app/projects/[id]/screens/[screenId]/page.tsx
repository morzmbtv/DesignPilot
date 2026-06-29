import { ArrowLeft, Check, Clock3, Plus, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AiGeneratePanel } from "@/components/ai-generate-panel";
import { EditCurrentVersionPanel } from "@/components/edit-current-version-panel";
import { VersionApproval } from "@/components/version-approval";
import { LatestVersionCard } from "@/components/latest-version-card";
import { VersionCopyActions } from "@/components/version-copy-actions";
import { AiPromptDebugger } from "@/components/ai-prompt-debugger";
import { LayoutEditor } from "@/components/wireframe/LayoutEditor";
import { ModeOnly } from "@/components/interface-mode";
import { ScreenActionBar } from "@/components/screen-action-bar";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { createScreenVersion, deleteScreen, updateScreen } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ScreenPage({ params }: { params: { id: string; screenId: string } }) {
  const user = await requireUser();
  const screen = await prisma.screen.findFirst({
    where: { id: params.screenId, projectId: params.id, project: { userId: user.id } },
    include: {
      project: { select: { name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { aiPromptLogs: { orderBy: { createdAt: "desc" }, take: 1 }, styleSimilarityReport: true },
      },
      summaries: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  if (!screen) notFound();

  const save = updateScreen.bind(null, params.id, screen.id);
  const remove = deleteScreen.bind(null, params.id, screen.id);
  const addVersion = createScreenVersion.bind(null, params.id, screen.id);

  return (
    <AppShell projectId={params.id} projectName={screen.project.name}>
      <Link href={`/projects/${params.id}/screens`} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet">
        <ArrowLeft size={17} /> Экраны · {screen.project.name}
      </Link>
      <div id="overview" className="mt-6 scroll-mt-24 flex items-start justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl font-black tracking-[-0.04em]">{screen.name}</h1><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${screen.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{screen.status === "approved" ? "Утверждён" : "Черновик"}</span>{screen.versions[0] ? <span className="text-sm font-bold text-muted">Версия {screen.versions[0].versionNumber}</span> : null}</div>
          <p className="mt-2 text-sm text-muted">{screen.purpose || "Опишите, что пользователь должен увидеть и сделать на этом экране."}</p>
        </div>
      </div>
      <div id="prompt" className="scroll-mt-24"><ScreenActionBar projectId={params.id} screenId={screen.id} versionId={screen.versions[0]?.id ?? null} imagePrompt={screen.versions[0]?.imagePrompt ?? ""} approved={screen.approvedVersionId === screen.versions[0]?.id} /></div>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Разделы экрана">{[["#overview", "Обзор"], ["#scheme", "Схема"], ["#prompt", "Промпт"], ["#versions", "Версии"], ["#additional", "Дополнительно"]].map(([href, label]) => <a key={href} href={href} className="whitespace-nowrap px-4 py-3 text-sm font-bold text-muted hover:text-violet">{label}</a>)}</nav>

      <section className="mt-6 rounded-2xl border border-violet/15 bg-violet/[0.035] p-5"><h2 className="font-black">Пять шагов до готового экрана</h2><div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2 xl:grid-cols-5">{["Заполните память проекта", "Сгенерируйте вариант", "Проверьте схему", "Скопируйте промпт", "Утвердите версию"].map((item, index) => <div key={item} className="flex gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet text-xs font-black text-white">{index + 1}</span><span>{item}</span></div>)}</div></section>

      <ModeOnly mode="expert"><form action={save} className="mt-8 grid gap-5 rounded-2xl border border-line p-5 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <label className="text-sm font-bold">
          Название
          <input name="name" required defaultValue={screen.name} className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm" />
        </label>
        <label className="text-sm font-bold">
          Статус
          <input type="hidden" name="status" value={screen.status} />
          <span className={`mt-2 flex h-12 items-center rounded-xl border px-4 text-sm ${screen.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line bg-[#fafaff] text-muted"}`}>
            {screen.status === "approved" ? "Утверждён" : "Черновик"}
          </span>
        </label>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white">
          <Check size={17} /> Сохранить
        </button>
        <label className="text-sm font-bold sm:col-span-3">
          Назначение
          <textarea name="purpose" rows={3} defaultValue={screen.purpose} className="mt-2 w-full resize-y rounded-xl border border-line px-4 py-3 text-sm leading-6" />
        </label>
      </form></ModeOnly>

      <ModeOnly mode="expert"><div>{screen.versions[0] ? (
        <LatestVersionCard
          version={screen.versions[0]}
          approved={screen.approvedVersionId === screen.versions[0].id}
          formattedDate={dateFormatter.format(screen.versions[0].createdAt)}
        />
      ) : null}</div></ModeOnly>
      <ModeOnly mode="expert">{screen.versions[0]?.styleSimilarityReport ? (
        <section className="mt-5 rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.1em] text-muted">Сходство стиля</p><h2 className="mt-1 text-lg font-black">Соответствие библиотеке проекта</h2></div><span className={`text-3xl font-black ${screen.versions[0].styleSimilarityReport.score >= 90 ? "text-emerald-600" : "text-amber-600"}`}>{Math.round(screen.versions[0].styleSimilarityReport.score)}%</span></div>
          {screen.versions[0].styleSimilarityReport.score < 90 ? <p className="mt-3 text-sm text-muted">{formatJsonList(screen.versions[0].styleSimilarityReport.reasonsJson)}</p> : null}
        </section>
      ) : null}</ModeOnly>
      <ModeOnly mode="expert">{screen.summaries[0] ? (
        <section className="mt-8 rounded-[22px] border border-emerald-100 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Сводка утверждённого экрана</p><h2 className="mt-2 text-xl font-black">{screen.summaries[0].summary}</h2></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Основная версия</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SummaryField label="Назначение" value={screen.summaries[0].mainPurpose} />
            <SummaryField label="Главное действие пользователя" value={screen.summaries[0].primaryUserAction || "Не определено"} />
            <SummaryField label="Использованные паттерны" value={formatJsonList(screen.summaries[0].usedPatterns)} />
            <SummaryField label="Применённые правила" value={formatJsonList(screen.summaries[0].usedRules)} />
          </div>
        </section>
      ) : null}</ModeOnly>
      <div id="scheme" className="scroll-mt-24">{screen.versions[0] ? (
        <LayoutEditor
          projectId={params.id}
          screenId={screen.id}
          screenName={screen.name}
          version={{
            id: screen.versions[0].id,
            versionNumber: screen.versions[0].versionNumber,
            layoutJson: screen.versions[0].layoutJson,
            designSpec: screen.versions[0].designSpec,
            imagePrompt: screen.versions[0].imagePrompt,
            htmlLayout: screen.versions[0].htmlLayout,
            flutterWidgetTree: screen.versions[0].flutterWidgetTree,
          }}
        />
      ) : <section className="mt-8 rounded-[22px] border border-dashed border-line bg-white p-10 text-center"><h2 className="text-xl font-black">Схема пока не создана</h2><p className="mt-2 text-sm text-muted">Нажмите «Сгенерировать», чтобы получить первый вариант.</p><a href="#generate" className="mt-5 inline-flex h-11 items-center rounded-xl bg-violet px-5 text-sm font-bold text-white">Сгенерировать</a></section>}</div>

      <section id="generate" className="scroll-mt-24"><details open={!screen.versions.length} className="mt-8"><summary className="cursor-pointer rounded-2xl border border-violet/20 bg-violet/[0.035] p-5 text-lg font-black">Сгенерировать новый вариант</summary><AiGeneratePanel
        projectId={params.id}
        screenId={screen.id}
        projectName={screen.project.name}
        screenName={screen.name}
      /></details></section>

      <section id="edit" className="scroll-mt-24"><details className="mt-4"><summary className="cursor-pointer rounded-2xl border border-line bg-white p-5 text-lg font-black">Изменить текущую версию</summary><EditCurrentVersionPanel
        projectId={params.id}
        screenId={screen.id}
        currentVersionNumber={screen.versions[0]?.versionNumber ?? null}
      /></details></section>

      <div id="versions" className="mt-12 grid scroll-mt-24 gap-8 xl:grid-cols-[1fr_380px]">
        <section>
          <h2 className="text-2xl font-black tracking-[-0.03em]">Версии экрана</h2>
          <p className="mt-1 text-sm text-muted">Каждая генерация сохраняется отдельной неизменяемой версией.</p>
          <div className="mt-6 space-y-4">
            {screen.versions.length ? screen.versions.map((version) => (
              <article key={version.id} className={`rounded-2xl border p-5 ${screen.approvedVersionId === version.id ? "border-emerald-200 bg-emerald-50/20" : "border-line"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-black">Версия {version.versionNumber}</h3>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <Clock3 size={14} /> {dateFormatter.format(version.createdAt)}
                  </span>
                </div>
                {version.changeSummary ? <p className="mt-3 text-sm font-bold text-violet">{version.changeSummary}</p> : null}
                <ModeOnly mode="expert"><VersionBlock label="Запрос пользователя" value={version.userRequest} /><VersionBlock label="Спецификация дизайна" value={version.designSpec} /><VersionBlock label="Промпт для изображения" value={version.imagePrompt} mono /><VersionBlock label="Изменения" value={version.diff} /></ModeOnly>
                <div className="mt-5">
                  <VersionCopyActions designSpec={version.designSpec} imagePrompt={version.imagePrompt} compact />
                </div>
                <ModeOnly mode="expert">{version.aiPromptLogs[0] ? (
                  <div className="mt-3">
                    <AiPromptDebugger
                      log={{ ...version.aiPromptLogs[0], createdAt: version.aiPromptLogs[0].createdAt.toISOString() }}
                      artifacts={{ layoutJson: version.layoutJson, htmlLayout: version.htmlLayout, flutterWidgetTree: version.flutterWidgetTree, imagePrompt: version.imagePrompt }}
                    />
                  </div>
                ) : null}</ModeOnly>
                <VersionApproval
                  projectId={params.id}
                  screenId={screen.id}
                  versionId={version.id}
                  versionNumber={version.versionNumber}
                  isApproved={screen.approvedVersionId === version.id}
                  initialRules={parseVersionRules(version.newRulesJson)}
                />
              </article>
            )) : (
              <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">Версий пока нет.</div>
            )}
          </div>
        </section>

        <ModeOnly mode="expert"><aside className="h-fit rounded-2xl bg-[#fafaff] p-5">
          <h2 className="font-black">Добавить версию</h2>
          <form action={addVersion} className="mt-5 space-y-4">
            <VersionField name="changeSummary" label="Что изменилось" placeholder="Краткое описание изменений" />
            <VersionField name="userRequest" label="Запрос пользователя" placeholder="Что попросил изменить пользователь?" multiline />
            <VersionField name="designSpec" label="Спецификация дизайна" placeholder="Структура и дизайн решения" multiline />
            <VersionField name="imagePrompt" label="Промпт для изображения" placeholder="Промпт для генерации изображения" multiline />
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-white">
              <Plus size={17} /> Сохранить версию
            </button>
          </form>
        </aside></ModeOnly>
      </div>
      <ModeOnly mode="simple"><details id="additional" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer text-sm font-bold">Дополнительно</summary><p className="mt-3 text-sm leading-6 text-muted">JSON, HTML, Flutter, отладка промпта и технические журналы доступны в экспертном режиме.</p></details></ModeOnly>
      <ModeOnly mode="expert"><details id="additional" className="mt-8 scroll-mt-24 rounded-2xl border border-red-100 bg-white p-5"><summary className="cursor-pointer text-sm font-bold text-red-600">Дополнительно</summary><form action={remove} className="mt-4"><ConfirmSubmitButton message={`Удалить экран «${screen.name}»? Это действие нельзя отменить.`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600"><Trash2 size={16} /> Удалить экран</ConfirmSubmitButton></form></details></ModeOnly>
    </AppShell>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#fafaff] p-4"><p className="text-xs font-black uppercase tracking-[0.08em] text-muted">{label}</p><p className="mt-2 text-sm leading-6 text-ink">{value}</p></div>;
}

function formatJsonList(value: string | null) {
  if (!value) return "Не зафиксировано";
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.join(", ") || "Не зафиксировано" : value;
  } catch {
    return value;
  }
}

function VersionBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-1 whitespace-pre-wrap text-sm leading-6 text-ink ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function VersionField({ name, label, placeholder, multiline = false }: { name: string; label: string; placeholder: string; multiline?: boolean }) {
  const classes = "mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm";
  return (
    <label className="block text-xs font-bold text-muted">
      {label}
      {multiline ? <textarea name={name} rows={4} placeholder={placeholder} className={`${classes} resize-y leading-5`} /> : <input name={name} placeholder={placeholder} className={classes} />}
    </label>
  );
}

function parseVersionRules(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((rule) => {
      if (typeof rule !== "object" || rule === null) return [];
      const candidate = rule as Record<string, unknown>;
      if (
        typeof candidate.category !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.value !== "string"
      ) {
        return [];
      }
      return [{
        category: candidate.category,
        name: candidate.name,
        value: candidate.value,
        source: typeof candidate.source === "string" ? candidate.source : "ai",
      }];
    });
  } catch {
    return [];
  }
}
