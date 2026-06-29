import { ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DesignDecisionsPanel } from "@/components/design-decisions-panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      designDecisions: {
        include: { screen: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!project) notFound();
  const decisions = project.designDecisions.map((decision) => ({
    ...decision,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  }));
  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <Link href={`/projects/${project.id}/memory`} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet"><ArrowLeft size={17} /> {project.name}</Link>
      <div className="mt-6 flex items-start gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><Scale size={23} /></span>
        <div><h1 className="text-4xl font-black tracking-[-0.045em]">Дизайн-решения</h1><p className="mt-2 text-sm text-muted">История решений, которые формируют визуальный язык проекта.</p></div>
      </div>
      <DesignDecisionsPanel projectId={project.id} decisions={decisions} />
    </AppShell>
  );
}
