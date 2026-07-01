import { ImageIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectAssetsPanel } from "@/components/assets/ProjectAssetsPanel";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function ProjectAssetsPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      name: true,
      projectAssets: { orderBy: [{ isPrimaryLogo: "desc" }, { createdAt: "desc" }] },
      screens: { orderBy: { updatedAt: "desc" }, select: { id: true, name: true, status: true } },
    },
  });
  if (!project) notFound();

  return (
    <AppShell projectId={project.id} projectName={project.name}>
      <div className="flex items-start gap-4 rounded-[22px] border border-line bg-white p-5 sm:p-8">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet/10 text-violet"><ImageIcon size={23} /></span>
        <div>
          <p className="text-sm font-bold text-violet">Библиотека проекта</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">Ассеты</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Загружайте логотипы и изображения, создавайте ассеты через OpenRouter и добавляйте их на Canvas как обычные слои.</p>
        </div>
      </div>
      <ProjectAssetsPanel
        projectId={project.id}
        initialAssets={project.projectAssets.map((asset) => ({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString() }))}
        screens={project.screens}
        imageModelConfigured={Boolean(process.env.OPENROUTER_IMAGE_MODEL?.trim())}
      />
    </AppShell>
  );
}
