"use client";

import { BrainCircuit, FileCode2, FolderOpen, MonitorSmartphone, Scale, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AppNavigation({
  projectId,
  mobile = false,
}: {
  projectId?: string;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const items = [
    { href: "/", label: "Projects", icon: FolderOpen, active: pathname === "/" || pathname === "/projects/new" },
    {
      href: projectId ? `/projects/${projectId}/memory` : "/",
      label: "Memory",
      icon: BrainCircuit,
      disabled: !projectId,
      active: Boolean(projectId && pathname.includes(`/projects/${projectId}/memory`) && hash !== "#project-rules"),
    },
    {
      href: projectId ? `/projects/${projectId}/screens` : "/",
      label: "Screens",
      icon: MonitorSmartphone,
      disabled: !projectId,
      active: Boolean(projectId && pathname.includes(`/projects/${projectId}/screens`)),
    },
    {
      href: projectId ? `/projects/${projectId}/memory#project-rules` : "/",
      label: "Rules",
      icon: ShieldCheck,
      disabled: !projectId,
      active: Boolean(projectId && pathname.includes(`/projects/${projectId}/memory`) && hash === "#project-rules"),
    },
    {
      href: projectId ? `/projects/${projectId}/decisions` : "/",
      label: "Decisions",
      icon: Scale,
      disabled: !projectId,
      active: Boolean(projectId && pathname.includes(`/projects/${projectId}/decisions`)),
    },
    {
      href: projectId ? `/projects/${projectId}/ai-logs` : "/",
      label: "AI Logs",
      icon: FileCode2,
      disabled: !projectId,
      active: Boolean(projectId && pathname.includes(`/projects/${projectId}/ai-logs`)),
    },
    {
      href: "/settings/openrouter",
      label: "Settings",
      icon: Settings,
      active: pathname.startsWith("/settings"),
    },
  ];

  return (
    <nav
      className={mobile ? "flex min-w-max gap-1 px-4 py-3" : "mt-10 space-y-1.5"}
      aria-label="Основная навигация"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-disabled={item.disabled}
            tabIndex={item.disabled ? -1 : undefined}
            title={item.disabled ? "Сначала откройте проект" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
              item.active
                ? "bg-violet/10 text-violet"
                : item.disabled
                  ? "cursor-not-allowed text-[#b3b5c2]"
                  : "text-muted hover:bg-[#f4f4f9] hover:text-ink"
            } ${mobile ? "whitespace-nowrap" : ""}`}
            onClick={item.disabled ? (event) => event.preventDefault() : undefined}
          >
            <Icon size={19} strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
