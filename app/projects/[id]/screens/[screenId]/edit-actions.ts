"use server";

import { revalidatePath } from "next/cache";
import { buildScreenEditPrompt, type ScreenEditPromptContext } from "@/lib/ai/prompts";
import { callOpenRouterTracked, completeAiPromptLog, OpenRouterError, type OpenRouterResponseFormat } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { parseDecisions, saveDecisions, type DecisionInput } from "@/lib/design-intelligence";

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
): Promise<EditScreenVersionResult> {
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
        },
        select: { id: true, versionNumber: true },
      });
      await saveDecisions(tx, { projectId, screenId, screenVersionId: created.id, decisions: edited.decisions });
      return created;
    });
    await completeAiPromptLog(logId, { parsedResponse: edited, screenVersionId: version.id });

    revalidatePath(`/projects/${projectId}/screens`);
    revalidatePath(`/projects/${projectId}/screens/${screenId}`);

    return {
      ok: true,
      versionNumber: version.versionNumber,
      ...edited,
    };
  } catch (error) {
    if (logId && error instanceof Error && error.message === "INVALID_AI_JSON") {
      await completeAiPromptLog(logId, { error: "INVALID_AI_JSON" });
    }
    if (error instanceof OpenRouterError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "INVALID_AI_JSON") {
      return { ok: false, error: "Модель вернула JSON в неверном формате. Повторите правку." };
    }
    return { ok: false, error: "Не удалось создать отредактированную версию." };
  }
}

export async function saveSuggestedProjectRule(
  projectId: string,
  input: SuggestedRule,
): Promise<{ ok: true; mode: "created" | "updated" } | { ok: false; error: string }> {
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
