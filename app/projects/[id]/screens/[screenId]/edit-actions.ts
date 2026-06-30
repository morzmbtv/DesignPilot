"use server";

import { revalidatePath } from "next/cache";
import { buildScreenEditPrompt, type ScreenEditPromptContext } from "@/lib/ai/prompts";
import { callOpenRouterTracked, completeAiPromptLog, OpenRouterError, type OpenRouterResponseFormat } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { parseDecisions, saveDecisions, type DecisionInput } from "@/lib/design-intelligence";
import { generateHtmlLayout } from "@/lib/design-code/html-layout-generator";
import { generateFlutterWidgetTree } from "@/lib/design-code/flutter-tree-generator";
import { validateLayoutJson, type LayoutElement, type LayoutJson } from "@/lib/layout";
import { assertProjectAccess, assertScreenAccess, requireUser } from "@/lib/security";
import { AiJsonRecoveryError, recoverJson, throwJsonRecoveryError } from "@/lib/ai/json-recovery";

export type SuggestedRule = {
  category: string;
  name: string;
  value: string;
  source: string;
};

export type EditScreenVersionResult =
  | {
      ok: true;
      versionNumber: number;
      updatedDesignSpec: string;
      updatedImagePrompt: string;
      updatedLayoutJson: LayoutJson;
      rulesToAddOrUpdate: SuggestedRule[];
      changeSummary: string;
      diff: string;
      decisions: DecisionInput[];
    }
  | { ok: false; error: string; recoverable?: boolean; logId?: string; model?: string; rawResponse?: string; parseError?: string; validation?: Record<string, string[]> };

const responseFormat: OpenRouterResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "edus_screen_version_edit",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        updatedDesignSpec: {
          type: "string",
          description: "Complete updated design specification with only the requested change applied.",
        },
        updatedImagePrompt: {
          type: "string",
          description: "Complete updated image generation prompt with only the requested change applied.",
        },
        updatedLayoutJson: {
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
        rulesToAddOrUpdate: {
          type: "array",
          description: "Project-level rule suggestions for global edits; empty for local edits.",
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
        changeSummary: { type: "string" },
        diff: {
          type: "string",
          description: "Concise human-readable before/after diff containing only changed details.",
        },
        decisions: {
          type: "array",
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
      },
      required: [
        "updatedDesignSpec",
        "updatedImagePrompt",
        "updatedLayoutJson",
        "rulesToAddOrUpdate",
        "changeSummary",
        "diff",
        "decisions",
      ],
    },
  },
};

export async function editCurrentScreenVersion(
  projectId: string,
  screenId: string,
  userRequest: string,
  selectedElementId?: string,
  unlockConfirmed = false,
): Promise<EditScreenVersionResult> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const request = userRequest.trim();
  if (!request) return { ok: false, error: "Введите правку для текущей версии." };

  const screen = await prisma.screen.findFirst({
    where: { id: screenId, projectId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      project: {
        include: {
          rules: { orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });

  if (!screen) return { ok: false, error: "Экран или проект не найден." };
  const latestVersion = screen.versions[0];
  if (!latestVersion) {
    return { ok: false, error: "Сначала создайте первую версию экрана через AI Generate." };
  }
  const currentLayout = latestVersion.layoutJson ? validateLayoutJson(JSON.parse(latestVersion.layoutJson)).layout : null;
  const lockedElements = currentLayout?.elements.filter((element) => element.locked) ?? [];
  const lockedIntent = detectsLockedEdit(request) && lockedElements.length > 0;
  if (lockedIntent && !unlockConfirmed) {
    return { ok: false, error: "Элемент заблокирован. Разблокировать и изменить?" };
  }

  const context: ScreenEditPromptContext = {
    project: {
      name: screen.project.name,
      styleDirection: screen.project.styleDirection,
      designRequirements: screen.project.designRequirements,
      constraints: screen.project.constraints,
    },
    projectRules: screen.project.rules.map(({ category, name, value, source }) => ({
      category,
      name,
      value,
      source,
    })),
    screen: {
      name: screen.name,
      purpose: screen.purpose,
    },
    latestVersion: {
      versionNumber: latestVersion.versionNumber,
      userRequest: latestVersion.userRequest,
      designSpec: latestVersion.designSpec,
      imagePrompt: latestVersion.imagePrompt,
      changeSummary: latestVersion.changeSummary,
      diff: latestVersion.diff,
      layoutJson: latestVersion.layoutJson ? JSON.parse(latestVersion.layoutJson) : null,
    },
  };

  let logId: string | null = null;
  try {
    const tracked = await callOpenRouterTracked(
      buildScreenEditPrompt(context, request),
      {
        responseFormat,
        temperature: 0.15,
        maxTokens: 6_000,
        log: { projectId, screenId, action: "edit_screen", requestPreview: request },
      },
    );
    logId = tracked.logId;
    const edited = parseEditedScreen(tracked.text);
    const targetedLockedIds = getTargetedLockedIds(lockedElements, request, selectedElementId);
    const changedLocked = lockedElements.filter((element) => {
      const candidate = edited.updatedLayoutJson.elements.find((item) => item.id === element.id);
      return !candidate || JSON.stringify(candidate) !== JSON.stringify(element);
    });
    if (changedLocked.length && !unlockConfirmed) {
      await completeAiPromptLog(logId, { parsedResponse: edited, error: "LOCKED_ELEMENT_CHANGED" });
      return { ok: false, error: `AI попытался изменить заблокированный элемент: ${changedLocked.map((item) => item.label || item.id).join(", ")}.` };
    }
    if (unlockConfirmed) {
      const deletedLocked = changedLocked.filter((element) => !edited.updatedLayoutJson.elements.some((candidate) => candidate.id === element.id));
      if (deletedLocked.length) {
        await completeAiPromptLog(logId, { parsedResponse: edited, error: "LOCKED_ELEMENT_DELETED" });
        return { ok: false, error: "AI не может удалить заблокированный элемент. Сначала разблокируйте его в редакторе расположения." };
      }
      const changedOutsideTarget = changedLocked.filter((element) => !targetedLockedIds.has(element.id));
      if (changedOutsideTarget.length) {
        await completeAiPromptLog(logId, { parsedResponse: edited, error: "NON_TARGET_LOCKED_ELEMENT_CHANGED" });
        return { ok: false, error: `AI попытался изменить другой заблокированный элемент: ${changedOutsideTarget.map((item) => item.label || item.id).join(", ")}.` };
      }
      edited.updatedLayoutJson = {
        ...edited.updatedLayoutJson,
        elements: edited.updatedLayoutJson.elements.map((candidate) => {
          const original = lockedElements.find((element) => element.id === candidate.id);
          if (!original) return candidate;
          return targetedLockedIds.has(candidate.id) ? { ...candidate, locked: false } : original;
        }),
      };
    }
    const layoutIntent = /ниже|выше|внизу|сверху|слева|справа|опустить|поднять|увеличить|уменьшить|шире|уже|размер|расположение|позиция/i.test(request);
    if (layoutIntent && latestVersion.layoutJson && JSON.stringify(JSON.parse(latestVersion.layoutJson)) === JSON.stringify(edited.updatedLayoutJson)) {
      await completeAiPromptLog(logId, { parsedResponse: { ...edited, detectedEditIntent: "layout", selectedElementId: selectedElementId || null, validationErrors: [] }, error: "LAYOUT_NOT_MODIFIED" });
      return { ok: false, error: "AI не изменил расположение элементов для этой правки." };
    }

    const codeRules = screen.project.rules.map(({ category, name, value }) => ({ category, name, value }));
    const htmlLayout = generateHtmlLayout(edited.updatedLayoutJson, edited.updatedDesignSpec, codeRules);
    const flutterWidgetTree = generateFlutterWidgetTree(edited.updatedLayoutJson, edited.updatedDesignSpec, codeRules);
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
          designSpec: edited.updatedDesignSpec,
          imagePrompt: edited.updatedImagePrompt,
          changeSummary: edited.changeSummary,
          diff: edited.diff,
          newRulesJson: JSON.stringify(edited.rulesToAddOrUpdate),
          layoutJson: JSON.stringify(edited.updatedLayoutJson),
          htmlLayout,
          flutterWidgetTree,
        },
        select: { id: true, versionNumber: true },
      });
      await saveDecisions(tx, { projectId, screenId, screenVersionId: created.id, decisions: edited.decisions });
      return created;
    });
    await completeAiPromptLog(logId, { parsedResponse: { ...edited, detectedEditIntent: layoutIntent ? "layout" : "content", selectedElementId: selectedElementId || null, validationErrors: [] }, screenVersionId: version.id });

    revalidatePath(`/projects/${projectId}/screens`);
    revalidatePath(`/projects/${projectId}/screens/${screenId}`);

    return {
      ok: true,
      versionNumber: version.versionNumber,
      ...edited,
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
          selectedElementId: selectedElementId || null,
        },
        error: error.message,
      });
      return {
        ok: false,
        error: "AI вернул ответ, который не удалось автоматически применить к текущей версии.",
        recoverable: true,
        logId,
        model: log?.model,
        rawResponse: log?.rawResponse ?? error.details.rawResponse,
        parseError: error.message,
        validation: { layout: error.details.validationErrors ?? [error.message] },
      };
    }
    if (error instanceof OpenRouterError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "INVALID_AI_JSON") {
      return { ok: false, error: "Модель вернула JSON в неверном формате. Повторите правку." };
    }
    if (error instanceof Error && error.message.startsWith("INVALID_LAYOUT_JSON")) return { ok: false, error: "AI не вернул корректную схему экрана." };
    return { ok: false, error: "Не удалось создать отредактированную версию." };
  }
}

export async function checkLockedEditIntent(projectId: string, screenId: string, userRequest: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const latest = await prisma.screenVersion.findFirst({
    where: { screenId, screen: { projectId } },
    orderBy: { versionNumber: "desc" },
    select: { layoutJson: true },
  });
  if (!latest?.layoutJson || !detectsLockedEdit(userRequest)) return { requiresConfirmation: false, elements: [] as string[] };
  const parsed = validateLayoutJson(JSON.parse(latest.layoutJson));
  const elements = parsed.layout?.elements.filter((element) => element.locked).map((element) => element.label || element.id) ?? [];
  return { requiresConfirmation: elements.length > 0, elements };
}

export async function repairEditAiLogJson(projectId: string, screenId: string, logId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const log = await prisma.aiPromptLog.findFirst({
    where: { id: logId, projectId, screenId },
    select: { rawResponse: true },
  });
  if (!log?.rawResponse) return { ok: false as const, error: "RAW ответ отсутствует в AI Log." };

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

export async function retryEditAiLogJson(projectId: string, screenId: string, logId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const log = await prisma.aiPromptLog.findFirst({
    where: { id: logId, projectId, screenId },
    select: { fullPrompt: true, rawResponse: true, requestPreview: true },
  });
  if (!log) return { ok: false as const, error: "AI Log не найден." };

  const messages = [
    ...parseMessages(log.fullPrompt),
    {
      role: "user" as const,
      content: `Предыдущий ответ модели был невалидным или не прошёл проверку.\n\nRAW RESPONSE:\n${log.rawResponse || "(empty)"}\n\nИсправь предыдущий JSON. Верни только валидный JSON без markdown, без пояснений и без текста вокруг JSON.`,
    },
  ];

  try {
    const tracked = await callOpenRouterTracked(messages, {
      responseFormat,
      temperature: 0,
      maxTokens: 6_000,
      log: { projectId, screenId, action: "edit_screen", requestPreview: `Retry JSON repair: ${log.requestPreview}` },
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

function detectsLockedEdit(request: string) {
  return /разблокир|заблокированн|locked/i.test(request);
}

function getTargetedLockedIds(locked: LayoutElement[], request: string, selectedElementId?: string) {
  const normalized = request.toLowerCase();
  const matched = locked.filter((element) =>
    element.id === selectedElementId ||
    normalized.includes(element.id.toLowerCase()) ||
    (element.label && normalized.includes(element.label.toLowerCase())));
  if (!matched.length && locked.length === 1) return new Set([locked[0].id]);
  return new Set(matched.map((element) => element.id));
}

export async function saveSuggestedProjectRule(
  projectId: string,
  input: SuggestedRule,
): Promise<{ ok: true; mode: "created" | "updated" } | { ok: false; error: string }> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const category = input.category.trim() || "Общее";
  const name = input.name.trim();
  const value = input.value.trim();
  if (!name || !value) return { ok: false, error: "Предложенное правило заполнено не полностью." };

  const existing = await prisma.projectRule.findFirst({
    where: { projectId, category, name },
    select: { id: true },
  });

  if (existing) {
    await prisma.projectRule.update({
      where: { id: existing.id },
      data: { value, source: "ai" },
    });
  } else {
    await prisma.projectRule.create({
      data: { projectId, category, name, value, source: "ai" },
    });
  }

  revalidatePath(`/projects/${projectId}/memory`);
  return { ok: true, mode: existing ? "updated" : "created" };
}

function parseEditedScreen(raw: string) {
  const recovery = recoverJson(raw);
  if (!recovery.ok) throwJsonRecoveryError(raw, recovery);
  const parsed = recovery.value;
  if (!isRecord(parsed)) throwJsonRecoveryError(raw, recovery, ["Ответ должен быть JSON-объектом."]);

  const updatedDesignSpec = stringField(parsed.updatedDesignSpec);
  const updatedImagePrompt = stringField(parsed.updatedImagePrompt);
  const layoutResult = validateLayoutJson(parsed.updatedLayoutJson);
  const errors = [
    ...(!updatedDesignSpec ? ["Поле updatedDesignSpec отсутствует или пустое."] : []),
    ...(!updatedImagePrompt ? ["Поле updatedImagePrompt отсутствует или пустое."] : []),
    ...(!layoutResult.valid || !layoutResult.layout ? layoutResult.errors.map((item) => `updatedLayoutJson: ${item}`) : []),
  ];
  if (errors.length) throwJsonRecoveryError(raw, recovery, errors);

  const rulesToAddOrUpdate = Array.isArray(parsed.rulesToAddOrUpdate) ? parsed.rulesToAddOrUpdate.flatMap((rule) => {
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

  return {
    updatedDesignSpec,
    updatedImagePrompt,
    updatedLayoutJson: layoutResult.layout!,
    rulesToAddOrUpdate,
    changeSummary: stringField(parsed.changeSummary) || "AI edit",
    diff: stringField(parsed.diff) || "Изменения применены.",
    decisions,
    aiRecovery: { stages: recovery.stages, warnings: recovery.warnings, repaired: recovery.repairedText !== recovery.jsonText },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
