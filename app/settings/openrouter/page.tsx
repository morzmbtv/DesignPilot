import { ArrowLeft, Cable } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OpenRouterTestForm } from "@/components/openrouter-test-form";
import { requireUser } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { OpenRouterImageTestForm } from "@/components/openrouter-image-test-form";

export const dynamic = "force-dynamic";

export default async function OpenRouterSettingsPage() {
  const user = await requireUser();
  const defaultModel = process.env.OPENROUTER_MODEL?.trim() || "";
  const isKeyConfigured = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const imageModelConfigured = Boolean(process.env.OPENROUTER_IMAGE_MODEL?.trim());
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } });

  return (
    <AppShell>
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet">
        <ArrowLeft size={17} /> К проектам
      </Link>
      <div className="mt-7 flex items-start gap-4 rounded-[22px] border border-line bg-white p-5 sm:p-8">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet/10 text-violet">
          <Cable size={23} />
        </span>
        <div>
          <h1 className="text-4xl font-black tracking-[-0.04em]">OpenRouter</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-muted">
            Проверьте подключение модели перед генерацией спецификаций и промптов.
          </p>
        </div>
      </div>
      <OpenRouterTestForm defaultModel={defaultModel} isKeyConfigured={isKeyConfigured} />
      <OpenRouterImageTestForm projects={projects} configured={imageModelConfigured} />
      <p className="mt-6 max-w-2xl text-xs leading-5 text-muted">
        API-ключ читается только сервером из переменной OPENROUTER_API_KEY и не передаётся в браузер.
        Модель из этого поля применяется только к тестовому запросу.
      </p>
    </AppShell>
  );
}
