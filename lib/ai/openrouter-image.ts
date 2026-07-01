import "server-only";

import { prisma } from "@/lib/prisma";
import { assertProjectAccess, requireUser } from "@/lib/security";
import { MAX_ASSET_BYTES, type ProjectAssetType } from "@/lib/assets";

const IMAGE_API_URL = "https://openrouter.ai/api/v1/images";
const TIMEOUT_MS = 120_000;

type GenerateOptions = {
  name: string;
  useProjectStyle?: boolean;
  background?: "auto" | "transparent" | "opaque";
  aspectRatio?: string;
  outputFormat?: "png" | "jpeg" | "webp";
  logAction?: "generate_asset" | "test_image_generation";
  screenId?: string;
};

type ImageResponse = {
  created?: number;
  data?: Array<{ b64_json?: string; media_type?: string }>;
  usage?: Record<string, unknown>;
  error?: { message?: string; code?: string | number };
};

export class OpenRouterImageError extends Error {
  constructor(
    message: string,
    public readonly attempts: string[] = [],
    public readonly rawResponse?: string,
  ) {
    super(message);
    this.name = "OpenRouterImageError";
  }
}

export async function generateImageAsset(
  projectId: string,
  prompt: string,
  type: ProjectAssetType,
  options: GenerateOptions,
) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const primaryModel = process.env.OPENROUTER_IMAGE_MODEL?.trim();
  if (!apiKey || !primaryModel) {
    const message = !apiKey ? "OPENROUTER_API_KEY не настроен." : "Image model не настроена.";
    await prisma.aiPromptLog.create({
      data: {
        projectId,
        screenId: options.screenId,
        action: options.logAction || "generate_asset",
        model: primaryModel || "not-configured",
        provider: "openrouter",
        requestPreview: prompt.slice(0, 500),
        fullPrompt: prompt,
        error: message,
      },
    });
    throw new OpenRouterImageError(message);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: {
      rules: { select: { category: true, name: true, value: true } },
      designTokens: { select: { group: true, name: true, value: true } },
      projectAssets: { where: { isPrimaryLogo: true }, take: 1, select: { id: true, name: true } },
    },
  });
  if (!project) throw new OpenRouterImageError("Проект не найден.");

  const finalPrompt = buildAssetPrompt(project, prompt, type, options.useProjectStyle !== false);
  const fallbacks = (process.env.OPENROUTER_IMAGE_FALLBACK_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const models = Array.from(new Set([primaryModel, ...fallbacks]));
  const errors: string[] = [];

  for (const model of models) {
    const provider = model.includes("/") ? model.split("/")[0] : "openrouter";
    const log = await prisma.aiPromptLog.create({
      data: {
        projectId,
        screenId: options.screenId,
        action: options.logAction || "generate_asset",
        model,
        provider,
        requestPreview: prompt.slice(0, 500),
        fullPrompt: finalPrompt,
      },
      select: { id: true },
    });
    try {
      let retriedWithMinimalOptions = false;
      let result: ImageResponse;
      try {
        result = await requestImage({
          apiKey,
          model,
          prompt: finalPrompt,
          background: options.background || (type === "background" ? "opaque" : "transparent"),
          aspectRatio: options.aspectRatio || (type === "background" ? "9:16" : "1:1"),
          outputFormat: options.outputFormat || "png",
        });
      } catch {
        retriedWithMinimalOptions = true;
        result = await requestImage({ apiKey, model, prompt: finalPrompt });
      }
      const image = result.data?.[0];
      if (!image?.b64_json) throw new OpenRouterImageError("OpenRouter не вернул изображение.");
      const mimeType = image.media_type || mimeForFormat(options.outputFormat || "png");
      const bytes = Buffer.from(image.b64_json, "base64");
      if (bytes.byteLength > MAX_ASSET_BYTES) throw new OpenRouterImageError("Сгенерированный ассет превышает лимит 4 МБ.");
      const dataUrl = `data:${mimeType};base64,${image.b64_json}`;
      const rawResponse = JSON.stringify(result);
      await prisma.aiPromptLog.update({
        where: { id: log.id },
        data: {
          rawResponse,
          parsedResponse: JSON.stringify({ mimeType, byteLength: bytes.byteLength, model, retriedWithMinimalOptions }),
          finishReason: "completed",
          tokensJson: result.usage ? JSON.stringify(result.usage) : null,
        },
      });
      const asset = await prisma.projectAsset.create({
        data: {
          userId: user.id,
          projectId,
          name: options.name.trim() || "Сгенерированный ассет",
          type,
          source: "openrouter",
          mimeType,
          fileName: `${slug(options.name || type)}.${extensionForMime(mimeType)}`,
          fileSize: bytes.byteLength,
          dataUrl,
          prompt: finalPrompt,
          provider,
          model,
          isBrandAsset: type === "logo",
        },
      });
      return asset;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка генерации.";
      errors.push(`${model}: ${message}`);
      await prisma.aiPromptLog.update({
        where: { id: log.id },
        data: {
          error: message,
          ...(error instanceof OpenRouterImageError && error.rawResponse ? { rawResponse: error.rawResponse } : {}),
        },
      });
    }
  }

  throw new OpenRouterImageError(`Не удалось сгенерировать ассет. ${errors.join(" · ")}`, errors);
}

export async function testOpenRouterImage(projectId: string) {
  return generateImageAsset(projectId, "Минималистичная синяя круглая иконка проверки без текста", "icon", {
    name: "Тест OpenRouter Image",
    useProjectStyle: false,
    background: "transparent",
    aspectRatio: "1:1",
    logAction: "test_image_generation",
  });
}

function buildAssetPrompt(
  project: {
    name: string; description: string; targetUsers: string; appGoal: string; styleDirection: string;
    designRequirements: string; constraints: string;
    rules: Array<{ category: string; name: string; value: string }>;
    designTokens: Array<{ group: string; name: string; value: string }>;
    projectAssets: Array<{ id: string; name: string }>;
  },
  prompt: string,
  type: ProjectAssetType,
  useProjectStyle: boolean,
) {
  const colorTokens = project.designTokens.filter((token) => /color|цвет/i.test(`${token.group} ${token.name}`));
  return [
    `Create one standalone ${type} asset for the mobile app project "${project.name}".`,
    `User description: ${prompt.trim()}`,
    "Do not include text unless explicitly requested.",
    type === "background" ? "Create a clean full-screen background." : "Use a transparent or visually simple background when possible.",
    useProjectStyle ? `Project style: ${project.styleDirection || "clean modern mobile UI"}` : "",
    useProjectStyle ? `Project memory: ${project.description}; audience: ${project.targetUsers}; goal: ${project.appGoal}.` : "",
    useProjectStyle ? `Design requirements: ${project.designRequirements}. Constraints: ${project.constraints}.` : "",
    useProjectStyle && project.rules.length ? `Project rules: ${project.rules.map((rule) => `${rule.category}/${rule.name}: ${rule.value}`).join("; ")}` : "",
    useProjectStyle && colorTokens.length ? `Primary colors: ${colorTokens.map((token) => `${token.name}=${token.value}`).join(", ")}` : "",
    project.projectAssets[0] ? `A primary uploaded logo exists with assetRef=${project.projectAssets[0].id}. Do not redraw, recreate, imitate, or embed that logo.` : "",
    "Return image only.",
  ].filter(Boolean).join("\n");
}

async function requestImage(input: {
  apiKey: string; model: string; prompt: string; background?: string; aspectRatio?: string; outputFormat?: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-OpenRouter-Title": "DesignPilot",
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        n: 1,
        ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
        ...(input.background ? { background: input.background } : {}),
        ...(input.outputFormat ? { output_format: input.outputFormat } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as ImageResponse | null;
    if (!response.ok) throw new OpenRouterImageError(
      data?.error?.message || `OpenRouter Image вернул ошибку ${response.status}.`,
      [],
      data ? JSON.stringify(data) : undefined,
    );
    if (!data) throw new OpenRouterImageError("OpenRouter Image вернул пустой ответ.");
    return data;
  } catch (error) {
    if (error instanceof OpenRouterImageError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new OpenRouterImageError("OpenRouter Image не ответил за 120 секунд.");
    throw new OpenRouterImageError("Не удалось подключиться к OpenRouter Image.");
  } finally {
    clearTimeout(timeout);
  }
}

function mimeForFormat(format: string) {
  return format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
}
function extensionForMime(mime: string) {
  return mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/svg+xml" ? "svg" : "png";
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-+|-+$/g, "") || "asset";
}
