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
  | { ok: false; error: string };

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
    if (logId && error instanceof Error && (error.message === "INVALID_AI_JSON" || error.message.startsWith("INVALID_LAYOUT_JSON"))) {
      await completeAiPromptLog(logId, { parsedResponse: { validationErrors: error.message.split(":").slice(1), selectedElementId: selectedElementId || null }, error: error.message });
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
  try {
    const withoutFence = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end >= start ? withoutFence.slice(start, end + 1) : withoutFence) as unknown;
    if (!isRecord(parsed)) throw new Error("INVALID_AI_JSON");

    const updatedDesignSpec = requiredString(parsed.updatedDesignSpec);
    const updatedImagePrompt = requiredString(parsed.updatedImagePrompt);
    const layoutResult = validateLayoutJson(parsed.updatedLayoutJson);
    if (!layoutResult.valid || !layoutResult.layout) throw new Error(`INVALID_LAYOUT_JSON:${layoutResult.errors.join("|")}`);
    const changeSummary = requiredString(parsed.changeSummary);
    const diff = requiredString(parsed.diff);
    if (!Array.isArray(parsed.rulesToAddOrUpdate)) throw new Error("INVALID_AI_JSON");
    const rulesToAddOrUpdate = parsed.rulesToAddOrUpdate.map((rule) => {
      if (!isRecord(rule)) throw new Error("INVALID_AI_JSON");
      return {
        category: requiredString(rule.category),
        name: requiredString(rule.name),
        value: requiredString(rule.value),
        source: requiredString(rule.source),
      };
    });
    const decisions = parseDecisions(parsed.decisions);

    return {
      updatedDesignSpec,
      updatedImagePrompt,
      updatedLayoutJson: layoutResult.layout,
      rulesToAddOrUpdate,
      changeSummary,
      diff,
      decisions,
    };
  } catch {
    throw new Error("INVALID_AI_JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("INVALID_AI_JSON");
  return value.trim();
}
