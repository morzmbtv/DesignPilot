"use server";

import { revalidatePath } from "next/cache";
import { callOpenRouterTracked, completeAiPromptLog, OpenRouterError, type OpenRouterResponseFormat } from "@/lib/openrouter";
import { buildScreenGenerationPrompt, type ScreenGenerationPromptContext } from "@/lib/ai/prompts";
import { prisma } from "@/lib/prisma";
import { parseDecisions, saveDecisions, type DecisionInput } from "@/lib/design-intelligence";

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
  | { ok: false; error: string };

export type GenerateScreenResult =
  | {
      ok: true;
      versionNumber: number;
      designSpec: string;
      imagePrompt: string;
      newRules: GeneratedRule[];
      decisions: DecisionInput[];
      changeSummary: string;
    }
  | { ok: false; error: string };

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
      },
      required: ["designSpec", "imagePrompt", "newRules", "changeSummary", "decisions"],
    },
  },
};

export async function generateScreenWithAI(
  projectId: string,
  screenId: string,
  userRequest: string,
): Promise<GenerateScreenResult> {
  const request = userRequest.trim();
  if (!request) return { ok: false, error: "Введите запрос для генерации." };

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
        },
      })),
    relatedScreens: project.screens
      .filter((item) => item.id !== screen.id)
      .map((item) => ({ name: item.name, purpose: item.purpose, status: item.status })),
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
        },
        select: { id: true, versionNumber: true },
      });
      await saveDecisions(tx, { projectId, screenId, screenVersionId: created.id, decisions: generated.decisions });
      return created;
    });
    await completeAiPromptLog(logId, { parsedResponse: generated, screenVersionId: version.id });

    revalidatePath(`/projects/${projectId}/screens`);
    revalidatePath(`/projects/${projectId}/screens/${screenId}`);

    return {
      ok: true,
      versionNumber: version.versionNumber,
      ...generated,
    };
  } catch (error) {
    if (logId && error instanceof Error && error.message === "INVALID_AI_JSON") {
      await completeAiPromptLog(logId, { error: "INVALID_AI_JSON" });
    }
    if (error instanceof OpenRouterError) return { ok: false, error: error.message };
    if (error instanceof Error && error.message === "INVALID_AI_JSON") {
      return { ok: false, error: "Модель вернула JSON в неверном формате. Повторите генерацию." };
    }
    return { ok: false, error: "Не удалось создать версию экрана." };
  }
}

export async function previewScreenAiContext(
  projectId: string,
  screenId: string,
): Promise<AiContextPreviewResult> {
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

function parseGeneratedScreen(raw: string) {
  try {
    const withoutFence = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end >= start ? withoutFence.slice(start, end + 1) : withoutFence) as unknown;

    if (!isRecord(parsed)) throw new Error("INVALID_AI_JSON");
    const designSpec = requiredString(parsed.designSpec);
    const imagePrompt = requiredString(parsed.imagePrompt);
    const changeSummary = requiredString(parsed.changeSummary);
    if (!Array.isArray(parsed.newRules)) throw new Error("INVALID_AI_JSON");
    const newRules = parsed.newRules.map((rule) => {
      if (!isRecord(rule)) throw new Error("INVALID_AI_JSON");
      return {
        category: requiredString(rule.category),
        name: requiredString(rule.name),
        value: requiredString(rule.value),
        source: requiredString(rule.source),
      };
    });
    const decisions = parseDecisions(parsed.decisions);
    return { designSpec, imagePrompt, changeSummary, newRules, decisions };
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
