"use client";

import Link from "next/link";
import { useInterfaceMode } from "./interface-mode";

export function ProjectTabs({ id, active }: { id: string; active: "memory" | "screens" }) {
  const { mode } = useInterfaceMode();
  return (
    <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-line" aria-label="Разделы проекта">
      <Tab href={`/projects/${id}/memory`} current={active === "memory"}>Память проекта</Tab>
      <Tab href={`/projects/${id}/screens`} current={active === "screens"}>Экраны</Tab>
      <Tab href={`/projects/${id}/memory#project-rules`} current={false}>Правила</Tab>
      <Tab href={`/projects/${id}/library`} current={false}>Библиотека дизайна</Tab>
      {mode === "expert" ? <Tab href={`/projects/${id}/decisions`} current={false}>Решения</Tab> : null}
      {mode === "expert" ? <Tab href={`/projects/${id}/ai-logs`} current={false}>Журнал AI</Tab> : null}
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
