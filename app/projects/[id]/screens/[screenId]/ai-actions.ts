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
      layoutJson: LayoutJson;
      newRules: GeneratedRule[];
      decisions: DecisionInput[];
      componentSuggestions: ComponentCandidate[];
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
    await completeAiPromptLog(logId, { parsedResponse: generated, screenVersionId: version.id });
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
    if (logId && error instanceof Error && (error.message === "INVALID_AI_JSON" || error.message.startsWith("INVALID_LAYOUT_JSON"))) {
      await completeAiPromptLog(logId, { parsedResponse: { validationErrors: error.message.split(":").slice(1) }, error: error.message });
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
    const layoutResult = validateLayoutJson(parsed.layoutJson);
    if (!layoutResult.valid || !layoutResult.layout) throw new Error(`INVALID_LAYOUT_JSON:${layoutResult.errors.join("|")}`);
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
    const componentSuggestions = Array.isArray(parsed.componentSuggestions) ? parsed.componentSuggestions.flatMap((item) => {
      if (!isRecord(item) || typeof item.name !== "string") return [];
      const componentLayout = validateLayoutJson(item.layoutJson);
      if (!componentLayout.valid || !componentLayout.layout) return [];
      return [{ name: item.name, description: String(item.description ?? ""), category: String(item.category ?? "Misc"), designSpec: String(item.designSpec ?? ""), imagePrompt: String(item.imagePrompt ?? ""), layoutJson: componentLayout.layout, states: Array.isArray(item.states) ? item.states.map(String) : [], variants: Array.isArray(item.variants) ? item.variants.map(String) : [], usageGuidelines: String(item.usageGuidelines ?? ""), accessibilityNotes: String(item.accessibilityNotes ?? ""), reason: String(item.reason ?? "") }];
    }) : [];
    return { designSpec, imagePrompt, layoutJson: layoutResult.layout, changeSummary, newRules, decisions, componentSuggestions };
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
