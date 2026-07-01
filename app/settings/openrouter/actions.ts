"use server";

import { callOpenRouterTracked, completeAiPromptLog, OpenRouterError } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security";
import { testOpenRouterImage as runImageTest, OpenRouterImageError } from "@/lib/ai/openrouter-image";

export type OpenRouterTestResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function testOpenRouter(model: string): Promise<OpenRouterTestResult> {
  const user = await requireUser();
  const selectedModel = model.trim();
  if (!selectedModel) return { ok: false, error: "Укажите модель OpenRouter." };

  try {
    const messages = [
        {
          role: "system",
          content: "You are a connection test for DesignPilot. Answer briefly and do not use markdown.",
        },
        {
          role: "user",
          content: "Reply in Russian with one short sentence confirming that the OpenRouter connection works.",
        },
      ] as const;
    const project = await prisma.project.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (!project) return { ok: false, error: "Сначала создайте проект: AI Prompt Log требует projectId." };
    const text = await callOpenRouterTracked([...messages], {
      model: selectedModel,
      log: { projectId: project.id, action: "test_openrouter", requestPreview: "OpenRouter connection test" },
    }).then(async (result) => {
      await completeAiPromptLog(result.logId, { parsedResponse: { text: result.text } });
      return result.text;
    });
    return { ok: true, text };
  } catch (error) {
    if (error instanceof OpenRouterError) return { ok: false, error: error.message };
    return { ok: false, error: "Неизвестная ошибка OpenRouter." };
  }
}

export async function testOpenRouterImage(projectId: string): Promise<OpenRouterTestResult> {
  try {
    const asset = await runImageTest(projectId);
    return { ok: true, text: `Изображение создано и сохранено как ассет «${asset.name}».` };
  } catch (error) {
    if (error instanceof OpenRouterImageError) return { ok: false, error: error.message };
    return { ok: false, error: "Неизвестная ошибка OpenRouter Image." };
  }
}
