"use server";

import { revalidatePath } from "next/cache";
import { callOpenRouterTracked, completeAiPromptLog, OpenRouterError, type OpenRouterResponseFormat } from "@/lib/openrouter";
import { buildScreenGenerationPrompt, type ScreenGenerationPromptContext } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { parseDecisions, saveDecisions, type DecisionInput } from "@/lib/design-intelligence";
import { validateLayoutJson, type LayoutJson } from "@/lib/layout";
import { processGeneratedComponents } from "@/app/projects/[id]/library/actions";
import { generateHtmlLayout } from "@/lib/design-code/html-layout-generator";
import { generateFlutterWidgetTree } from "@/lib/design-code/flutter-tree-generator";
import { styleSimilarity, type ComponentCandidate } from "@/lib/design-library/intelligence";
import { assertProjectAccess, assertScreenAccess, requireUser } from "@/lib/security";
import { AiJsonRecoveryError, recoverJson, throwJsonRecoveryError } from "@/lib/ai/json-recovery";

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
  type: "json_schema",
  json_schema: {
    name: "edus_screen_design",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        designSpec: {
          type: "string",
          description: "Precise implementation-ready mobile screen specification.",
        },
        imagePrompt: {
          type: "string",
          description: "Standalone prompt ready to paste into ChatGPT image generation.",
        },
        layoutJson: {
          type: "object", additionalProperties: false,
          properties: {
            viewport: { type: "object", additionalProperties: false, properties: { width: { type: "number" }, height: { type: "number" } }, required: ["width", "height"] },
            elements: { type: "array", items: { type: "object", additionalProperties: false, properties: {
              id: { type: "string" }, type: { type: "string" }, label: { type: "string" },
              x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" },
              align: { type: "string" }, style: { type: "string" }, radius: { type: "number" },
              background: { type: "string" }, opacity: { type: "number" }, zIndex: { type: "number" }, locked: { type: "boolean" },
            }, required: ["id", "type", "label", "x", "y", "width", "height", "align", "style", "radius", "background", "opacity", "zIndex", "locked"] } },
          }, required: ["viewport", "elements"],
        },
        newRules: {
          type: "array",
          description: "Only new reusable project-level design rules discovered while designing this screen.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              category: { type: "string" },
              name: { type: "string" },
              value: { type: "string" },
              source: { type: "string" },
            },
            required: ["category", "name", "value", "source"],
          },
        },
        changeSummary: {
          type: "string",
          description: "Short summary of what this version introduces or changes.",
        },
        decisions: {
          type: "array",
          description: "Design decisions discovered while creating this screen.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string" },
              target: { type: "string" },
              oldValue: { type: ["string", "null"] },
              newValue: { type: ["string", "null"] },
              reason: { type: ["string", "null"] },
              source: { type: "string" },
              status: { type: "string" },
            },
            required: ["type", "target", "oldValue", "newValue", "reason", "source", "status"],
          },
        },
        componentSuggestions: {
          type: "array", items: { type: "object", additionalProperties: false, properties: {
            name: { type: "string" }, description: { type: "string" }, category: { type: "string" },
            designSpec: { type: "string" }, imagePrompt: { type: "string" },
            layoutJson: {
              type: "object", additionalProperties: false,
              properties: {
                viewport: { type: "object", additionalProperties: false, properties: { width: { type: "number" }, height: { type: "number" } }, required: ["width", "height"] },
                elements: { type: "array", items: { type: "object", additionalProperties: false, properties: {
                  id: { type: "string" }, type: { type: "string" }, label: { type: "string" },
                  x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" },
                  align: { type: "string" }, style: { type: "string" }, radius: { type: "number" },
                  background: { type: "string" }, opacity: { type: "number" }, zIndex: { type: "number" }, locked: { type: "boolean" },
                }, required: ["id", "type", "label", "x", "y", "width", "height", "align", "style", "radius", "background", "opacity", "zIndex", "locked"] } },
              },
              required: ["viewport", "elements"],
            },
            states: { type: "array", items: { type: "string" } }, variants: { type: "array", items: { type: "string" } },
            usageGuidelines: { type: "string" }, accessibilityNotes: { type: "string" }, reason: { type: "string" },
          }, required: ["name", "description", "category", "designSpec", "imagePrompt", "layoutJson", "states", "variants", "usageGuidelines", "accessibilityNotes", "reason"] },
        },
      },
      required: ["designSpec", "imagePrompt", "layoutJson", "newRules", "changeSummary", "decisions", "componentSuggestions"],
    },
  },
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
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      project: {
        include: {
          rules: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
          designComponents: { where: { approved: true }, orderBy: { usageCount: "desc" }, take: 100 },
          designTokens: { orderBy: [{ group: "asc" }, { name: "asc" }] },
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

  const { project } = screen;
  const context: ScreenGenerationPromptContext = {
    project: {
      name: project.name,
      description: project.description,
      targetUsers: project.targetUsers,
      appGoal: project.appGoal,
      platform: project.platform,
      styleDirection: project.styleDirection,
      designRequirements: project.designRequirements,
      architectureNotes: project.architectureNotes,
      constraints: project.constraints,
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
      latestVersion: screen.versions[0]
        ? {
            versionNumber: screen.versions[0].versionNumber,
            designSpec: screen.versions[0].designSpec,
          imagePrompt: screen.versions[0].imagePrompt,
          changeSummary: screen.versions[0].changeSummary,
          layoutJson: screen.versions[0].layoutJson ? JSON.parse(screen.versions[0].layoutJson) : null,
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

    const generated = parseGeneratedScreen(tracked.text);
    const codeRules = project.rules.map(({ category, name, value }) => ({ category, name, value }));
    const htmlLayout = generateHtmlLayout(generated.layoutJson, generated.designSpec, codeRules);
    const flutterWidgetTree = generateFlutterWidgetTree(generated.layoutJson, generated.designSpec, codeRules);
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
          htmlLayout,
          flutterWidgetTree,
        },
        select: { id: true, versionNumber: true },
      });
      await saveDecisions(tx, { projectId, screenId, screenVersionId: created.id, decisions: generated.decisions });
      return created;
    });
    await completeAiPromptLog(logId, { parsedResponse: { ...generated, aiRecovery: generated.aiRecovery, validation: generated.validation }, screenVersionId: version.id, error: null });
    await processGeneratedComponents(projectId, generated.componentSuggestions, screenId, version.id);
    const similarity = styleSimilarity({ designSpec: generated.designSpec, layoutJson: generated.layoutJson, tokenValues: project.designTokens.map((token) => token.value) });
    await prisma.styleSimilarityReport.create({ data: { projectId, screenVersionId: version.id, score: similarity.score, reasonsJson: JSON.stringify(similarity.reasons) } });

    revalidatePath(`/projects/${projectId}/screens`);
    revalidatePath(`/projects/${projectId}/screens/${screenId}`);

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
  const approved = project.screens.filter((item) => item.status === "approved" && item.approvedVersion);
  const rawContext = {
    projectMemory: {
      name: project.name,
      description: project.description,
      targetUsers: project.targetUsers,
      appGoal: project.appGoal,
      platform: project.platform,
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

function parseGeneratedScreen(raw: string) {
  const recovery = recoverJson(raw);
  if (!recovery.ok) throwJsonRecoveryError(raw, recovery);
  const parsed = recovery.value;
  const validation = buildValidationReport(parsed);
  if (!isRecord(parsed)) throwJsonRecoveryError(raw, recovery, ["Ответ должен быть JSON-объектом."]);

  const designSpec = stringField(parsed.designSpec);
  const imagePrompt = stringField(parsed.imagePrompt);
  const layoutResult = validateLayoutJson(parsed.layoutJson);
  const errors = [
    ...(!designSpec ? ["Поле designSpec отсутствует или пустое."] : []),
    ...(!imagePrompt ? ["Поле imagePrompt отсутствует или пустое."] : []),
    ...(!layoutResult.valid || !layoutResult.layout ? layoutResult.errors.map((item) => `layoutJson: ${item}`) : []),
  ];
  if (errors.length) throwJsonRecoveryError(raw, recovery, errors);

  const newRules = Array.isArray(parsed.newRules) ? parsed.newRules.flatMap((rule) => {
    if (!isRecord(rule)) return [];
    const name = stringField(rule.name);
    const value = stringField(rule.value);
    if (!name || !value) return [];
    return {
      category: stringField(rule.category) || "Общее",
      name,
      value,
      source: stringField(rule.source) || "ai",
    };
  }) : [];
  const decisions = parseDecisions(parsed.decisions);
  const componentSuggestions = Array.isArray(parsed.componentSuggestions) ? parsed.componentSuggestions.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== "string") return [];
    const componentLayout = validateLayoutJson(item.layoutJson);
    if (!componentLayout.valid || !componentLayout.layout) return [];
    return [{ name: item.name, description: String(item.description ?? ""), category: String(item.category ?? "Misc"), designSpec: String(item.designSpec ?? ""), imagePrompt: String(item.imagePrompt ?? ""), layoutJson: componentLayout.layout, states: Array.isArray(item.states) ? item.states.map(String) : [], variants: Array.isArray(item.variants) ? item.variants.map(String) : [], usageGuidelines: String(item.usageGuidelines ?? ""), accessibilityNotes: String(item.accessibilityNotes ?? ""), reason: String(item.reason ?? "") }];
  }) : [];
  return {
    designSpec,
    imagePrompt,
    layoutJson: layoutResult.layout!,
    changeSummary: stringField(parsed.changeSummary) || "AI generation",
    newRules,
    decisions,
    componentSuggestions,
    validation,
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
  const layout = validateLayoutJson(record.layoutJson);
  return {
    layout: globalErrors.length ? globalErrors : layout.valid ? [] : layout.errors,
    components: Array.isArray(record.componentSuggestions) ? [] : ["componentSuggestions отсутствует — будет использован пустой список."],
    tokens: [],
    prompt: typeof record.imagePrompt === "string" && record.imagePrompt.trim() ? [] : ["imagePrompt отсутствует или пустой."],
    constraints: [],
    memory: typeof record.designSpec === "string" && record.designSpec.trim() ? [] : ["designSpec отсутствует или пустой."],
  };
}
