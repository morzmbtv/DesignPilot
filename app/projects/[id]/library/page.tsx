import { ArrowLeft, Library } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LibraryPanel } from "@/components/design-library/LibraryPanel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DesignLibraryPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      designComponents: { orderBy: { updatedAt: "desc" } },
      designTokens: { orderBy: [{ group: "asc" }, { name: "asc" }] },
      designAssets: { orderBy: { createdAt: "desc" } },
      designPatterns: { orderBy: { usageCount: "desc" } },
      designImports: { orderBy: { createdAt: "desc" } },
      similarityReports: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!project) notFound();

  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <Link href={`/projects/${project.id}/memory`} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet">
        <ArrowLeft size={17} /> {project.name}
      </Link>
      <div className="mt-6 flex items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><Library size={23} /></span>
        <div>
          <h1 className="text-4xl font-black tracking-[-0.045em]">Библиотека дизайна</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Компоненты, токены, ресурсы, импорты и контроль повторного использования дизайна проекта.</p>
        </div>
      </div>
      <LibraryPanel
        projectId={project.id}
        source={project.designSystemSource}
        components={project.designComponents.map((component) => ({
          ...component,
          lastUsedAt: component.lastUsedAt?.toISOString() ?? null,
        }))}
        tokens={project.designTokens}
        assets={project.designAssets}
        patterns={project.designPatterns}
        imports={project.designImports.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
        reports={project.similarityReports}
      />
    </AppShell>
  );
}
