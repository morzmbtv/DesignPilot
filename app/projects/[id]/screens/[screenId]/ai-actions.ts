"use server";

import { revalidatePath } from "next/cache";
import { callOpenRouterTracked, completeAiPromptLog, OpenRouterError, type OpenRouterResponseFormat } from "@/lib/openrouter";
import { buildScreenGenerationPrompt, type ScreenGenerationPromptContext } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { saveDecisions, type DecisionInput } from "@/lib/design-intelligence";
import { type LayoutJson } from "@/lib/layout";
import { processGeneratedComponents } from "@/app/projects/[id]/library/actions";
import { styleSimilarity, type ComponentCandidate } from "@/lib/design-library/intelligence";
import { assertProjectAccess, assertScreenAccess, requireUser } from "@/lib/security";
import { AiJsonRecoveryError, recoverJson, throwJsonRecoveryError } from "@/lib/ai/json-recovery";
import { compileDesignModel, DesignCompilerError } from "@/lib/idm/design-compiler";
import { applyPrimaryLogoPolicy, sanitizeAssetReferences } from "@/lib/idm/primary-logo";
import { hydrateVisualAssets } from "@/lib/ai/hydrate-visual-assets";
import { parseStyleDna, resolveViewport } from "@/lib/project-config";
import { planVisualScene } from "@/lib/idm/visual-scene-planner";
import { applyViewportToIdm } from "@/lib/idm/viewport";
import { resolveCompositionLayout } from "@/lib/design-engine/layout-engine";
import { normalizeLayoutToViewport } from "@/lib/design-engine/viewport-normalizer";

export type GeneratedRule = {
  category: string;
  name: string;
  value: string;
  source: string;
};

export type AiContextPreviewResult =
  | {
      ok: true;
      projectMemory: string;
      projectRulesCount: number;
      approvedScreens: string[];
      relatedScreens: string[];
      approvedSummaries: string[];
      constraints: string;
      model: string;
      rawContext: string;
    }
  | {
      ok: false;
      error: string;
      recoverable?: boolean;
      logId?: string;
      model?: string;
      rawResponse?: string;
      parseError?: string;
      validation?: PipelineValidationReport;
    };

export type PipelineValidationReport = {
  layout: string[];
  components: string[];
  tokens: string[];
  prompt: string[];
  constraints: string[];
  memory: string[];
};

export type GenerateScreenResult =
  | {
      ok: true;
      versionNumber: number;
      designSpec: string;
      imagePrompt: string;
      layoutJson: LayoutJson;
      newRules: GeneratedRule[];
      decisions: DecisionInput[];
      componentSuggestions: ComponentCandidate[];
      changeSummary: string;
      warnings: string[];
      generatedAssetIds: string[];
      sceneType: string;
      sceneElementIds: string[];
    }
  | {
      ok: false;
      error: string;
      recoverable?: boolean;
      logId?: string;
      model?: string;
      rawResponse?: string;
      parseError?: string;
      validation?: PipelineValidationReport;
    };

const responseFormat: OpenRouterResponseFormat = {
  type: "json_object",
};

export async function generateScreenWithAI(
  projectId: string,
  screenId: string,
  userRequest: string,
): Promise<GenerateScreenResult> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const request = userRequest.trim();
  if (!request) return { ok: false, error: "Введите запрос для генерации." };

  const screen = await prisma.screen.findFirst({
    where: { id: screenId, projectId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { internalDesignModel: true } },
      project: {
        include: {
          rules: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
          designComponents: { where: { approved: true }, orderBy: { usageCount: "desc" }, take: 100 },
          designTokens: { orderBy: [{ group: "asc" }, { name: "asc" }] },
          projectAssets: { select: { id: true, name: true, type: true, width: true, height: true, isPrimaryLogo: true, isBrandAsset: true } },
          screens: {
            orderBy: { createdAt: "asc" },
            include: {
              approvedVersion: { include: { internalDesignModel: true } },
              summaries: { orderBy: { updatedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!screen) return { ok: false, error: "Экран или проект не найден." };

  const { project } = screen;
  const styleDna = parseStyleDna(project.styleDna);
  const effectivePlatform = screen.platform !== "inherit" ? screen.platform : project.platform;
  const effectivePreset = screen.viewportPreset !== "inherit" ? screen.viewportPreset : project.viewportPreset;
  const viewport = resolveViewport({
    platform: effectivePlatform,
    viewportPreset: effectivePreset,
    customViewportWidth: screen.viewportPreset === "custom" ? screen.customViewportWidth : project.customViewportWidth,
    customViewportHeight: screen.viewportPreset === "custom" ? screen.customViewportHeight : project.customViewportHeight,
  });
  const primaryLogo = project.projectAssets.find((asset) => asset.isPrimaryLogo) ?? null;
  const context: ScreenGenerationPromptContext = {
    project: {
      name: project.name,
      type: project.projectType,
      description: project.description,
      targetUsers: project.targetUsers,
      appGoal: project.appGoal,
      platform: effectivePlatform,
      styleDirection: project.styleDirection,
      designRequirements: project.designRequirements,
      architectureNotes: project.architectureNotes,
      constraints: project.constraints,
      styleDna,
      viewport: { width: viewport.width, height: viewport.height, preset: viewport.preset },
    },
    projectRules: project.rules.map(({ category, name, value, source }) => ({
      category,
      name,
      value,
      source,
    })),
    targetScreen: {
      name: screen.name,
      purpose: screen.purpose,
      status: screen.status,
      platform: effectivePlatform,
      latestVersion: screen.versions[0]
        ? {
            versionNumber: screen.versions[0].versionNumber,
            designSpec: screen.versions[0].designSpec,
          imagePrompt: screen.versions[0].imagePrompt,
          changeSummary: screen.versions[0].changeSummary,
          layoutJson: screen.versions[0].layoutJson ? JSON.parse(screen.versions[0].layoutJson) : null,
          internalDesignModel: screen.versions[0].internalDesignModel?.normalizedJson
            ? JSON.parse(screen.versions[0].internalDesignModel.normalizedJson)
            : screen.versions[0].internalDesignModel?.modelJson
              ? JSON.parse(screen.versions[0].internalDesignModel.modelJson)
              : null,
          }
        : null,
    },
    approvedScreens: project.screens
      .filter((item) => item.status === "approved" && item.approvedVersion)
      .map((item) => ({
        name: item.name,
        purpose: item.purpose,
        summary: item.summaries[0]?.summary,
        approvedVersion: {
          versionNumber: item.approvedVersion!.versionNumber,
          designSpec: item.approvedVersion!.designSpec,
          imagePrompt: item.approvedVersion!.imagePrompt,
          changeSummary: item.approvedVersion!.changeSummary,
          layoutJson: item.approvedVersion!.layoutJson ? JSON.parse(item.approvedVersion!.layoutJson) : null,
          internalDesignModel: item.approvedVersion!.internalDesignModel?.normalizedJson
            ? JSON.parse(item.approvedVersion!.internalDesignModel.normalizedJson)
            : item.approvedVersion!.internalDesignModel?.modelJson
              ? JSON.parse(item.approvedVersion!.internalDesignModel.modelJson)
              : null,
        },
      })),
    relatedScreens: project.screens
      .filter((item) => item.id !== screen.id)
      .map((item) => ({ name: item.name, purpose: item.purpose, status: item.status })),
    designLibrary: {
      source: project.designSystemSource,
      approvedComponents: project.designComponents.map(({ id, name, category, description, layoutJson, states, variants }) => ({ id, name, category, description, layoutJson, states, variants })),
      tokens: project.designTokens.map(({ group, name, value }) => ({ group, name, value })),
    },
    assets: {
      primaryLogo: primaryLogo ? { id: primaryLogo.id, name: primaryLogo.name } : null,
      available: project.projectAssets.map(({ id, name, type, isPrimaryLogo, isBrandAsset }) => ({ id, name, type, isPrimaryLogo, isBrandAsset })),
    },
  };

  let logId: string | null = null;
  try {
    const messages = buildScreenGenerationPrompt(context, request);
    const tracked = await callOpenRouterTracked(
      messages,
      {
        responseFormat,
        temperature: 0.25,
        maxTokens: 6_000,
        log: { projectId, screenId, action: "generate_screen", requestPreview: request },
      },
    );
    logId = tracked.logId;

    const codeRules = project.rules.map(({ category, name, value }) => ({ category, name, value }));
    const parsedGenerated = parseGeneratedScreen(
      tracked.text,
      codeRules,
      primaryLogo,
      project.projectAssets.map((asset) => asset.id),
      /splash|логотип|logo/i.test(`${screen.name} ${screen.purpose} ${request}`),
    );
    const viewportIdm = applyViewportToIdm(parsedGenerated.internalDesignModel, viewport, effectivePlatform);
    const scene = planVisualScene(viewportIdm, {
      screenName: screen.name,
      screenPurpose: screen.purpose,
      userRequest: request,
      projectName: project.name,
      projectType: project.projectType,
      platform: effectivePlatform,
      styleDna,
      projectMemory: [project.description, project.targetUsers, project.appGoal, project.styleDirection, project.designRequirements, project.architectureNotes, project.constraints].join("\n"),
      projectRules: project.rules.map((rule) => `${rule.category}/${rule.name}: ${rule.value}`),
      primaryLogo,
    });
    const layoutEngine = resolveCompositionLayout(scene.idm);
    const viewportNormalization = normalizeLayoutToViewport(layoutEngine.idm, layoutEngine.entries);
    const resolvedSceneIdm = {
      ...viewportNormalization.idm,
      layoutEngine: {
        viewport: { width: viewport.width, height: viewport.height },
        entries: viewportNormalization.entries,
        warnings: [...layoutEngine.warnings, ...viewportNormalization.warnings],
      },
    };
    const hydration = await hydrateVisualAssets(projectId, screenId, resolvedSceneIdm);
    const hydratedCompiled = compileDesignModel(hydration.idm, codeRules);
    const generated = {
      ...parsedGenerated,
      designSpec: hydratedCompiled.designSpec,
      imagePrompt: hydratedCompiled.imagePrompt,
      layoutJson: hydratedCompiled.layoutJson,
      htmlLayout: hydratedCompiled.htmlLayout,
      flutterWidgetTree: hydratedCompiled.flutterWidgetTree,
      animationSpec: hydratedCompiled.animationSpec,
      exportJson: hydratedCompiled.exportJson,
      internalDesignModel: hydratedCompiled.idm,
      idmValidation: hydratedCompiled.validation,
      componentSuggestions: hydratedCompiled.componentSuggestions,
      warnings: [...scene.warnings, ...layoutEngine.warnings, ...viewportNormalization.warnings, ...hydration.warnings],
      generatedAssetIds: hydration.generatedAssetIds,
      sceneType: scene.sceneType,
      sceneElementIds: scene.addedElementIds,
    };
    const usedAssetIds = Array.from(new Set(generated.internalDesignModel.hierarchy.elements.flatMap((element) => element.content.assetRef ? [element.content.assetRef] : [])));
    const version = await prisma.$transaction(async (tx) => {
      const latest = await tx.screenVersion.findFirst({
        where: { screenId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const created = await tx.screenVersion.create({
        data: {
          screenId,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          userRequest: request,
          designSpec: generated.designSpec,
          imagePrompt: generated.imagePrompt,
          changeSummary: generated.changeSummary,
          newRulesJson: JSON.stringify(generated.newRules),
          layoutJson: JSON.stringify(generated.layoutJson),
          htmlLayout: generated.htmlLayout,
          flutterWidgetTree: generated.flutterWidgetTree,
        },
        select: { id: true, versionNumber: true },
      });
      await tx.screenDesign.create({
        data: {
          projectId,
          screenId,
          screenVersionId: created.id,
          modelJson: JSON.stringify(generated.internalDesignModel),
          normalizedJson: JSON.stringify(generated.internalDesignModel),
          validationJson: JSON.stringify(generated.idmValidation),
        },
      });
      await saveDecisions(tx, { projectId, screenId, screenVersionId: created.id, decisions: generated.decisions });
      for (const assetId of usedAssetIds) {
        await tx.projectAsset.updateMany({ where: { id: assetId, projectId }, data: { usageCount: { increment: 1 } } });
      }
      return created;
    });
    await completeAiPromptLog(logId, { parsedResponse: { ...generated, aiRecovery: generated.aiRecovery, validation: generated.validation, internalDesignModel: generated.internalDesignModel }, screenVersionId: version.id, error: null });
    await processGeneratedComponents(projectId, generated.componentSuggestions, screenId, version.id);
    const similarity = styleSimilarity({ designSpec: generated.designSpec, layoutJson: generated.layoutJson, tokenValues: project.designTokens.map((token) => token.value) });
    await prisma.styleSimilarityReport.create({ data: { projectId, screenVersionId: version.id, score: similarity.score, reasonsJson: JSON.stringify(similarity.reasons) } });

    revalidatePath(`/projects/${projectId}/screens`);
    revalidatePath(`/projects/${projectId}/screens/${screenId}`);
    revalidatePath(`/projects/${projectId}/assets`);

    return {
      ok: true,
      versionNumber: version.versionNumber,
      ...generated,
    };
  } catch (error) {
    if (logId && error instanceof AiJsonRecoveryError) {
      const log = await prisma.aiPromptLog.findUnique({ where: { id: logId }, select: { model: true, rawResponse: true } });
      await completeAiPromptLog(logId, {
        parsedResponse: {
          aiRecovery: {
            stages: error.details.stages,
            warnings: error.details.warnings,
            jsonText: error.details.jsonText,
            repairedText: error.details.repairedText,
          },
          validationErrors: error.details.validationErrors ?? [],
        },
        error: error.message,
      });
      return {
        ok: false,
        error: "AI вернул ответ, который не удалось автоматически привести к рабочей версии.",
        recoverable: true,
        logId,
        model: log?.model,
        rawResponse: log?.rawResponse ?? error.details.rawResponse,
        parseError: error.message,
        validation: buildValidationReport(null, error.details.validationErrors ?? [error.message]),
      };
    }
    if (error instanceof OpenRouterError) return { ok: false, error: error.message };
    if (error instanceof DesignCompilerError) {
      return {
        ok: false,
        error: "IDM не прошёл проверку Design Compiler.",
        recoverable: true,
        logId: logId ?? undefined,
        parseError: error.message,
        validation: buildValidationReport(null, error.validationErrors),
      };
    }
    if (error instanceof Error && error.message === "INVALID_AI_JSON") {
      return { ok: false, error: "Модель вернула JSON в неверном формате. Повторите генерацию." };
    }
    if (error instanceof Error && error.message.startsWith("INVALID_LAYOUT_JSON")) return { ok: false, error: "AI не вернул корректную схему экрана." };
    return { ok: false, error: "Не удалось создать версию экрана." };
  }
}

export async function previewScreenAiContext(
  projectId: string,
  screenId: string,
): Promise<AiContextPreviewResult> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const screen = await prisma.screen.findFirst({
    where: { id: screenId, projectId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      project: {
        include: {
          rules: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
          projectAssets: { select: { id: true, name: true, type: true, isPrimaryLogo: true, isBrandAsset: true } },
          screens: {
            orderBy: { createdAt: "asc" },
            include: {
              approvedVersion: true,
              summaries: { orderBy: { updatedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!screen) return { ok: false, error: "Экран или проект не найден." };
  const project = screen.project;
  const previewPlatform = screen.platform !== "inherit" ? screen.platform : project.platform;
  const previewViewport = resolveViewport({
    platform: previewPlatform,
    viewportPreset: screen.viewportPreset !== "inherit" ? screen.viewportPreset : project.viewportPreset,
    customViewportWidth: screen.viewportPreset === "custom" ? screen.customViewportWidth : project.customViewportWidth,
    customViewportHeight: screen.viewportPreset === "custom" ? screen.customViewportHeight : project.customViewportHeight,
  });
  const approved = project.screens.filter((item) => item.status === "approved" && item.approvedVersion);
  const rawContext = {
    projectMemory: {
      name: project.name,
      projectType: project.projectType,
      description: project.description,
      targetUsers: project.targetUsers,
      appGoal: project.appGoal,
      platform: previewPlatform,
      viewport: previewViewport,
      styleDna: parseStyleDna(project.styleDna),
      styleDirection: project.styleDirection,
      designRequirements: project.designRequirements,
      architectureNotes: project.architectureNotes,
      constraints: project.constraints,
    },
    projectRules: project.rules,
    targetScreen: {
      name: screen.name,
      purpose: screen.purpose,
      latestVersion: screen.versions[0] ?? null,
    },
    approvedScreens: approved.map((item) => ({
      name: item.name,
      purpose: item.purpose,
      approvedVersion: item.approvedVersion,
      summary: item.summaries[0] ?? null,
    })),
    relatedScreens: project.screens.filter((item) => item.id !== screen.id).map((item) => ({
      name: item.name,
      purpose: item.purpose,
      status: item.status,
    })),
    assets: {
      primaryLogo: project.projectAssets.find((asset) => asset.isPrimaryLogo) ?? null,
      available: project.projectAssets,
      instruction: project.projectAssets.some((asset) => asset.isPrimaryLogo)
        ? "Использовать только assetRef основного логотипа; не рисовать и не заменять логотип."
        : "Основной логотип не загружен.",
    },
    model: process.env.OPENROUTER_MODEL?.trim() || "not configured",
  };
  return {
    ok: true,
    projectMemory: `${project.name} · ${project.description || "без описания"}`,
    projectRulesCount: project.rules.length,
    approvedScreens: approved.map((item) => item.name),
    relatedScreens: project.screens.filter((item) => item.id !== screen.id).map((item) => item.name),
    approvedSummaries: approved.flatMap((item) => item.summaries[0]?.summary ? [item.summaries[0].summary] : []),
    constraints: project.constraints,
    model: process.env.OPENROUTER_MODEL?.trim() || "not configured",
    rawContext: JSON.stringify(rawContext, null, 2),
  };
}

export async function repairAiLogJson(projectId: string, screenId: string, logId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const log = await prisma.aiPromptLog.findFirst({
    where: { id: logId, projectId, screenId },
    select: { rawResponse: true },
  });
  if (!log?.rawResponse) return { ok: false as const, error: "Raw response отсутствует в AI Log." };
  const recovered = recoverJson(log.rawResponse);
  if (!recovered.ok) {
    await completeAiPromptLog(logId, {
      parsedResponse: { aiRecovery: recovered, validationErrors: [recovered.error] },
      error: recovered.error,
    });
    return { ok: false as const, error: recovered.error, rawResponse: log.rawResponse };
  }
  await completeAiPromptLog(logId, {
    parsedResponse: {
      parsedJson: recovered.value,
      aiRecovery: { stages: recovered.stages, warnings: recovered.warnings, repaired: recovered.repairedText !== recovered.jsonText },
    },
    error: null,
  });
  return { ok: true as const, parsedJson: recovered.value, repairedText: recovered.repairedText };
}

export async function retryAiLogJson(projectId: string, screenId: string, logId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const log = await prisma.aiPromptLog.findFirst({
    where: { id: logId, projectId, screenId },
    select: { fullPrompt: true, rawResponse: true, action: true, requestPreview: true },
  });
  if (!log) return { ok: false as const, error: "AI Log не найден." };
  const previousMessages = parseMessages(log.fullPrompt);
  const messages = [
    ...previousMessages,
    {
      role: "user" as const,
      content: `Предыдущий ответ модели был невалидным или не прошёл проверку.\n\nRAW RESPONSE:\n${log.rawResponse || "(empty)"}\n\nИсправь предыдущий JSON. Верни только валидный JSON без markdown, без пояснений, без текста вокруг JSON.`,
    },
  ];
  try {
    const tracked = await callOpenRouterTracked(messages, {
      responseFormat,
      temperature: 0,
      maxTokens: 6_000,
      log: { projectId, screenId, action: "generate_screen", requestPreview: `Retry JSON repair: ${log.requestPreview}` },
    });
    const recovered = recoverJson(tracked.text);
    if (!recovered.ok) {
      await completeAiPromptLog(tracked.logId, { parsedResponse: { aiRecovery: recovered }, error: recovered.error });
      return { ok: false as const, error: recovered.error, logId: tracked.logId, rawResponse: tracked.text };
    }
    await completeAiPromptLog(tracked.logId, {
      parsedResponse: {
        parsedJson: recovered.value,
        aiRecovery: { stages: recovered.stages, warnings: recovered.warnings, repaired: recovered.repairedText !== recovered.jsonText },
      },
      error: null,
    });
    return { ok: true as const, logId: tracked.logId, parsedJson: recovered.value, rawResponse: tracked.text };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось повторить запрос." };
  }
}

function parseMessages(value: string): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!isRecord(item) || !["system", "user", "assistant"].includes(String(item.role)) || typeof item.content !== "string") return [];
      return [{ role: item.role as "system" | "user" | "assistant", content: item.content }];
    });
  } catch {
    return [];
  }
}

function parseGeneratedScreen(
  raw: string,
  projectRules: Array<{ category: string; name: string; value: string }>,
  primaryLogo: { id: string; name: string; width: number | null; height: number | null } | null,
  validAssetIds: string[],
  ensureLogo: boolean,
) {
  const recovery = recoverJson(raw);
  if (!recovery.ok) throwJsonRecoveryError(raw, recovery);
  const parsed = recovery.value;
  if (!isRecord(parsed)) throwJsonRecoveryError(raw, recovery, ["Ответ должен быть JSON-объектом."]);
  const candidate = compileDesignModel(parsed, projectRules);
  const sanitized = sanitizeAssetReferences(candidate.idm, validAssetIds);
  const compiled = compileDesignModel(applyPrimaryLogoPolicy(sanitized, primaryLogo, ensureLogo), projectRules);
  return {
    designSpec: compiled.designSpec,
    imagePrompt: compiled.imagePrompt,
    layoutJson: compiled.layoutJson,
    htmlLayout: compiled.htmlLayout,
    flutterWidgetTree: compiled.flutterWidgetTree,
    animationSpec: compiled.animationSpec,
    exportJson: compiled.exportJson,
    internalDesignModel: compiled.idm,
    idmValidation: compiled.validation,
    changeSummary: compiled.idm.exportMetadata.changeSummary || "IDM generation",
    newRules: [] as GeneratedRule[],
    decisions: [] as DecisionInput[],
    componentSuggestions: compiled.componentSuggestions,
    validation: {
      layout: compiled.validation.errors.filter((item) => item.toLowerCase().includes("layout")),
      components: [],
      tokens: [],
      prompt: compiled.imagePrompt ? [] : ["imagePrompt не был скомпилирован."],
      constraints: compiled.validation.errors.filter((item) => item.toLowerCase().includes("constraint")),
      memory: compiled.designSpec ? [] : ["designSpec не был скомпилирован."],
    },
    aiRecovery: { stages: recovery.stages, warnings: recovery.warnings, repaired: recovery.repairedText !== recovery.jsonText },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildValidationReport(value: unknown, globalErrors: string[] = []): PipelineValidationReport {
  const record = isRecord(value) ? value : {};
  return {
    layout: globalErrors.length ? globalErrors : isRecord(record.hierarchy) ? [] : ["IDM hierarchy отсутствует."],
    components: Array.isArray(record.componentSuggestions) ? [] : [],
    tokens: [],
    prompt: [],
    constraints: [],
    memory: isRecord(record.metadata) ? [] : ["IDM metadata отсутствует."],
  };
}
