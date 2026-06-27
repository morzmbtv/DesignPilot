import { ChevronRight, Sparkles } from "lucide-react";
import { Logo } from "./logo";
import { AppNavigation } from "./app-navigation";

export function AppShell({
  children,
  projectId,
  projectName,
}: {
  children: React.ReactNode;
  projectId?: string;
  projectName?: string;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-line bg-white px-6 py-7 lg:flex">
          <Logo />
          <AppNavigation projectId={projectId} />
          <div className="mt-auto">
            {projectName ? (
              <div className="rounded-2xl border border-line bg-[#fafaff] p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">Selected project</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet text-sm font-black text-white">
                    {projectName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-black text-ink">{projectName}</span>
                  <ChevronRight size={17} className="text-muted" />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-violet/10 bg-[#faf9ff] p-5">
                <Sparkles className="text-violet" size={22} />
                <p className="mt-3 text-sm font-black text-ink">Design context, kept tidy</p>
                <p className="mt-1.5 text-xs leading-5 text-muted">Memory, rules and versions live in one workspace.</p>
              </div>
            )}
          </div>
        </aside>
        <div className="min-w-0 flex-1 bg-canvas">
          <header className="sticky top-0 z-30 flex h-16 items-center border-b border-line bg-white/95 px-5 backdrop-blur lg:hidden">
            <Logo />
          </header>
          <div className="sticky top-16 z-20 overflow-x-auto border-b border-line bg-white lg:hidden">
            <AppNavigation projectId={projectId} mobile />
          </div>
          <main className="mx-auto w-full max-w-[1450px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-14 xl:py-12">{children}</main>
        </div>
      </div>
    </div>
  );
}
