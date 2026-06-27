import { Clock3, Layers3 } from "lucide-react";
import { VersionCopyActions } from "./version-copy-actions";

export function LatestVersionCard({
  version,
  approved,
  formattedDate,
}: {
  version: {
    versionNumber: number;
    designSpec: string;
    imagePrompt: string;
    changeSummary: string;
  };
  approved: boolean;
  formattedDate: string;
}) {
  return (
    <section className="mt-8 rounded-[22px] border border-violet/20 bg-white p-5 shadow-soft sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet/10 text-violet"><Layers3 size={20} /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black tracking-[-0.025em]">Latest version</h2>
              <span className="rounded-full bg-violet/10 px-2.5 py-1 text-xs font-bold text-violet">Version {version.versionNumber}</span>
              {approved ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Approved</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Draft</span>}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{version.changeSummary || "Последняя сохранённая версия экрана."}</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted"><Clock3 size={14} /> {formattedDate}</span>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <VersionPreview title="Design Spec" value={version.designSpec} mono={false} />
        <VersionPreview title="Image Prompt" value={version.imagePrompt} mono />
      </div>
      <div className="mt-5">
        <VersionCopyActions designSpec={version.designSpec} imagePrompt={version.imagePrompt} />
      </div>
    </section>
  );
}

function VersionPreview({ title, value, mono }: { title: string; value: string; mono: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-[#fafaff] p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{title}</p>
      <p className={`mt-3 line-clamp-[9] whitespace-pre-wrap text-sm leading-6 text-ink ${mono ? "font-mono text-[12px]" : ""}`}>
        {value || "Содержимое пока не добавлено."}
      </p>
    </div>
  );
}
