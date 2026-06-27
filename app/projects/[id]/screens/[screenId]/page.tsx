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
import { createScreenVersion, deleteScreen, updateScreen } from "@/app/actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ScreenPage({ params }: { params: { id: string; screenId: string } }) {
  const screen = await prisma.screen.findFirst({
    where: { id: params.screenId, projectId: params.id },
    include: {
      project: { select: { name: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { aiPromptLogs: { orderBy: { createdAt: "desc" }, take: 1 } },
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
      <div className="mt-6 flex items-start justify-between gap-5">
        <div>
          <h1 className="text-4xl font-black tracking-[-0.04em]">{screen.name}</h1>
          <p className="mt-2 text-sm text-muted">Карточка экрана и история Design Spec.</p>
        </div>
        <form action={remove}>
          <button aria-label="Удалить экран" className="flex size-11 items-center justify-center rounded-xl border border-line text-muted hover:border-red-200 hover:text-red-600">
            <Trash2 size={18} />
          </button>
        </form>
      </div>

      <form action={save} className="mt-8 grid gap-5 rounded-2xl border border-line p-5 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <label className="text-sm font-bold">
          Название
          <input name="name" required defaultValue={screen.name} className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-sm" />
        </label>
        <label className="text-sm font-bold">
          Статус
          <input type="hidden" name="status" value={screen.status} />
          <span className={`mt-2 flex h-12 items-center rounded-xl border px-4 text-sm ${screen.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line bg-[#fafaff] text-muted"}`}>
            {screen.status === "approved" ? "Approved" : "Draft"}
          </span>
        </label>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white">
          <Check size={17} /> Сохранить
        </button>
        <label className="text-sm font-bold sm:col-span-3">
          Назначение
          <textarea name="purpose" rows={3} defaultValue={screen.purpose} className="mt-2 w-full resize-y rounded-xl border border-line px-4 py-3 text-sm leading-6" />
        </label>
      </form>

      {screen.versions[0] ? (
        <LatestVersionCard
          version={screen.versions[0]}
          approved={screen.approvedVersionId === screen.versions[0].id}
          formattedDate={dateFormatter.format(screen.versions[0].createdAt)}
        />
      ) : null}
      {screen.summaries[0] ? (
        <section className="mt-8 rounded-[22px] border border-emerald-100 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Approved Screen Summary</p><h2 className="mt-2 text-xl font-black">{screen.summaries[0].summary}</h2></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Source of truth</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SummaryField label="Main purpose" value={screen.summaries[0].mainPurpose} />
            <SummaryField label="Primary user action" value={screen.summaries[0].primaryUserAction || "Не определено"} />
            <SummaryField label="Used patterns" value={formatJsonList(screen.summaries[0].usedPatterns)} />
            <SummaryField label="Applied rules" value={formatJsonList(screen.summaries[0].usedRules)} />
          </div>
        </section>
      ) : null}

      <AiGeneratePanel
        projectId={params.id}
        screenId={screen.id}
        projectName={screen.project.name}
        screenName={screen.name}
      />

      <EditCurrentVersionPanel
        projectId={params.id}
        screenId={screen.id}
        currentVersionNumber={screen.versions[0]?.versionNumber ?? null}
      />

      <div className="mt-12 grid gap-8 xl:grid-cols-[1fr_380px]">
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
                <VersionBlock label="Запрос пользователя" value={version.userRequest} />
                <VersionBlock label="Design Spec" value={version.designSpec} />
                <VersionBlock label="Image Prompt" value={version.imagePrompt} mono />
                <VersionBlock label="Diff" value={version.diff} />
                <div className="mt-5">
                  <VersionCopyActions designSpec={version.designSpec} imagePrompt={version.imagePrompt} compact />
                </div>
                {version.aiPromptLogs[0] ? (
                  <div className="mt-3">
                    <AiPromptDebugger log={{ ...version.aiPromptLogs[0], createdAt: version.aiPromptLogs[0].createdAt.toISOString() }} />
                  </div>
                ) : null}
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

        <aside className="h-fit rounded-2xl bg-[#fafaff] p-5">
          <h2 className="font-black">Добавить версию</h2>
          <form action={addVersion} className="mt-5 space-y-4">
            <VersionField name="changeSummary" label="Что изменилось" placeholder="Краткое описание изменений" />
            <VersionField name="userRequest" label="Запрос пользователя" placeholder="Что попросил изменить пользователь?" multiline />
            <VersionField name="designSpec" label="Design Spec" placeholder="Структура и дизайн решения" multiline />
            <VersionField name="imagePrompt" label="Image Prompt" placeholder="Промпт для генерации изображения" multiline />
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-bold text-white">
              <Plus size={17} /> Сохранить версию
            </button>
          </form>
        </aside>
      </div>
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
