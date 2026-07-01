import "server-only";

import { generateImageAsset, OpenRouterImageError } from "@/lib/ai/openrouter-image";
import type { InternalDesignModel } from "@/lib/idm/types";
import { attachGeneratedAsset, planMissingVisualAssets } from "@/lib/ai/visual-asset-planner";

type HydrationResult = {
  idm: InternalDesignModel;
  generatedAssetIds: string[];
  warnings: string[];
};

export async function hydrateVisualAssets(
  projectId: string,
  screenId: string,
  idm: InternalDesignModel,
): Promise<HydrationResult> {
  let current = idm;
  const generatedAssetIds: string[] = [];
  const warnings: string[] = [];
  const candidates = planMissingVisualAssets(current);

  const results = await Promise.all(candidates.map(async (candidate) => {
    const element = idm.hierarchy.elements.find((item) => item.id === candidate.elementId);
    if (!element || element.content.assetRef) return null;
    try {
      const asset = await generateImageAsset(projectId, candidate.prompt, candidate.type, {
        name: candidate.name,
        useProjectStyle: true,
        background: candidate.background,
        aspectRatio: candidate.aspectRatio,
        screenId,
      });
      return { ok: true as const, candidate, element, asset };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка генерации изображения.";
      return { ok: false as const, element, configurationError: isImageConfigurationError(error), message };
    }
  }));

  for (const result of results) {
    if (!result) continue;
    if (!result.ok) {
      warnings.push(result.configurationError
        ? "Генерация изображений не настроена"
        : `Не удалось создать изображение для «${result.element.name}»: ${result.message}`);
      continue;
    }
    generatedAssetIds.push(result.asset.id);
    current = attachGeneratedAsset(current, result.element.id, { id: result.asset.id, type: result.candidate.type });
  }

  return { idm: current, generatedAssetIds, warnings: Array.from(new Set(warnings)) };
}

function isImageConfigurationError(error: unknown) {
  return error instanceof OpenRouterImageError &&
    /OPENROUTER_API_KEY|Image model не настроена/i.test(error.message);
}
