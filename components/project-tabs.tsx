import Link from "next/link";

export function ProjectTabs({ id, active }: { id: string; active: "memory" | "screens" }) {
  return (
    <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-line" aria-label="Разделы проекта">
      <Tab href={`/projects/${id}/memory`} current={active === "memory"}>Project Memory</Tab>
      <Tab href={`/projects/${id}/screens`} current={active === "screens"}>Screens</Tab>
      <Tab href={`/projects/${id}/memory#project-rules`} current={false}>Rules</Tab>
      <Tab href={`/projects/${id}/decisions`} current={false}>Decisions</Tab>
      <Tab href={`/projects/${id}/ai-logs`} current={false}>AI Logs</Tab>
    </nav>
  );
}

function Tab({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`relative whitespace-nowrap px-4 py-3 text-sm font-bold ${current ? "text-violet after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-violet" : "text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
