"use server";

import { extname } from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { componentSimilarity, type ComponentCandidate } from "@/lib/design-library/intelligence";
import { generateHtmlLayout } from "@/lib/design-code/html-layout-generator";
import { generateFlutterWidgetTree } from "@/lib/design-code/flutter-tree-generator";
import { assertProjectAccess, requireUser } from "@/lib/security";

export async function setDesignSystemSource(projectId: string, source: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await prisma.project.update({ where: { id: projectId }, data: { designSystemSource: source } });
  revalidatePath(`/projects/${projectId}/library`);
}

export async function setComponentStatus(projectId: string, componentId: string, status: "approved" | "rejected") {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const component = await prisma.designComponent.findFirst({ where: { id: componentId, projectId } });
  if (!component) return { ok: false as const, error: "Компонент не найден." };
  const history = parseList(component.approveHistory);
  history.push({ status, date: new Date().toISOString(), by: "user" });
  await prisma.designComponent.update({
    where: { id: componentId },
    data: { status, approved: status === "approved", approveHistory: JSON.stringify(history) },
  });
  revalidatePath(`/projects/${projectId}/library`);
  return { ok: true as const };
}

export async function reuseExistingComponent(projectId: string, draftId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const draft = await prisma.designComponent.findFirst({ where: { id: draftId, projectId, status: "draft" } });
  if (!draft) return { ok: false as const, error: "Черновик компонента не найден." };
  const basedOnId = parseList(draft.basedOnComponents).find((value): value is string => typeof value === "string");
  if (!basedOnId) return { ok: false as const, error: "Для этого черновика не найден похожий компонент." };
  const existing = await prisma.designComponent.findFirst({ where: { id: basedOnId, projectId, approved: true } });
  if (!existing) return { ok: false as const, error: "Похожий утверждённый компонент не найден." };
  const sourceScreen = draft.sourceScreenId
    ? await prisma.screen.findFirst({ where: { id: draft.sourceScreenId, projectId }, select: { name: true } })
    : null;

  await prisma.$transaction([
    prisma.designComponent.update({
      where: { id: existing.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        screensUsedIn: appendUnique(existing.screensUsedIn, draft.sourceScreenId ?? undefined),
        usedInScreens: appendUnique(existing.usedInScreens, sourceScreen?.name),
        projectsUsedIn: appendUnique(existing.projectsUsedIn, projectId),
        similarityHistory: appendHistory(existing.similarityHistory, {
          candidate: draft.name,
          action: "reuse_after_review",
          at: new Date().toISOString(),
          screenId: draft.sourceScreenId,
        }),
      },
    }),
    prisma.designComponent.update({
      where: { id: draft.id },
      data: {
        status: "rejected",
        approved: false,
        approveHistory: appendHistory(draft.approveHistory, {
          status: "rejected",
          reason: "reused_existing_component",
          replacementComponentId: existing.id,
          at: new Date().toISOString(),
        }),
      },
    }),
  ]);
  revalidatePath(`/projects/${projectId}/library`);
  return { ok: true as const, componentName: existing.name };
}

export async function saveDesignToken(projectId: string, input: { group: string; name: string; value: string; description?: string }) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  if (!input.name.trim() || !input.value.trim()) return { ok: false as const, error: "Укажите название и значение токена." };
  await prisma.designToken.upsert({
    where: { projectId_group_name: { projectId, group: input.group, name: input.name.trim() } },
    create: { projectId, group: input.group, name: input.name.trim(), value: input.value.trim(), description: input.description?.trim() || "" },
    update: { value: input.value.trim(), description: input.description?.trim() || "" },
  });
  revalidatePath(`/projects/${projectId}/library`);
  return { ok: true as const };
}

export async function saveDesignComponent(projectId: string, componentId: string, input: {
  name: string; description: string; category: string; layoutJson: string;
  states: string; variants: string; usageGuidelines: string; accessibilityNotes: string;
}) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const component = await prisma.designComponent.findFirst({ where: { id: componentId, projectId } });
  if (!component) return { ok: false as const, error: "Компонент не найден." };
  if (!input.name.trim()) return { ok: false as const, error: "Название компонента обязательно." };
  if (input.layoutJson.trim()) {
    try { JSON.parse(input.layoutJson); } catch { return { ok: false as const, error: "Layout JSON содержит ошибку." }; }
  }
  const history = parseList(component.editHistory);
  history.push({ date: new Date().toISOString(), by: "user", fields: Object.keys(input) });
  await prisma.designComponent.update({
    where: { id: componentId },
    data: {
      name: input.name.trim(), description: input.description.trim(), category: input.category,
      layoutJson: input.layoutJson.trim() || null, states: input.states.trim() || null,
      variants: input.variants.trim() || null, usageGuidelines: input.usageGuidelines.trim() || null,
      accessibilityNotes: input.accessibilityNotes.trim() || null, editHistory: JSON.stringify(history),
    },
  });
  revalidatePath(`/projects/${projectId}/library`);
  return { ok: true as const };
}

export async function analyzeDesignImport(projectId: string, formData: FormData) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const type = String(formData.get("type") || "layout_json");
  const payload = String(formData.get("payload") || "").trim();
  const uploadedFiles = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  const legacyFile = formData.get("file");
  if (legacyFile instanceof File && legacyFile.size > 0) uploadedFiles.push(legacyFile);
  const file = uploadedFiles[0];
  const item = await prisma.designImport.create({
    data: {
      projectId,
      type,
      name: file?.name || `Импорт ${type}`,
      sourcePath: null,
      status: "analyzing",
    },
  });

  try {
    let analysis: Record<string, unknown> = {};
    const candidates: ComponentCandidate[] = [];
    const tokens: Array<{ group: string; name: string; value: string }> = [];

    if (type === "flutter_project" && uploadedFiles.length) {
      const dartFiles = uploadedFiles.filter((uploaded) => uploaded.name.toLowerCase().endsWith(".dart")).slice(0, 500);
      const contents = await Promise.all(dartFiles.map((uploaded) => uploaded.text().catch(() => "")));
      const text = contents.join("\n");
      Array.from(text.matchAll(/Color\(0x([A-Fa-f0-9]{8})\)/g)).forEach((match, index) => tokens.push({ group: "Цвета", name: `flutter_color_${index + 1}`, value: `#${match[1].slice(2)}` }));
      Array.from(text.matchAll(/(?:BorderRadius\.circular|Radius\.circular)\((\d+(?:\.\d+)?)\)/g)).forEach((match, index) => tokens.push({ group: "Радиусы", name: `radius_${index + 1}`, value: `${match[1]}px` }));
      Array.from(text.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)).forEach((match, index) => tokens.push({ group: "Типографика", name: `font_size_${index + 1}`, value: `${match[1]}px` }));
      Array.from(text.matchAll(/class\s+(\w+)\s+extends\s+(?:StatelessWidget|StatefulWidget)/g)).slice(0, 60).forEach((match) => candidates.push({
        name: match[1],
        category: inferCategory(match[1]),
        description: "Flutter Widget, найденный при анализе проекта.",
        reason: "Импортирован из Flutter-кода.",
      }));
      analysis = { files: dartFiles.length, widgets: candidates.length, tokens: tokens.length, detected: ["ThemeData", "ColorScheme", "Typography", "Widgets", "Radius", "Assets"] };
    } else if (["design_tokens_json", "layout_json", "theme_file"].includes(type)) {
      const parsed = JSON.parse(payload || (file ? await file.text() : "{}"));
      flattenTokens(parsed).forEach((token) => tokens.push(token));
      analysis = { keys: tokens.length, format: type };
    } else if (file) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const preview = file.type.startsWith("image/") ? `data:${file.type};base64,${bytes.toString("base64")}` : null;
      await prisma.designAsset.create({
        data: { projectId, name: file.name, type: extname(file.name).slice(1) || file.type, preview, metadata: JSON.stringify({ size: file.size, mime: file.type }) },
      });
      candidates.push({
        name: file.name.replace(/\.[^.]+$/, ""),
        category: "Misc",
        description: "Предложение компонента из визуального импорта.",
        reason: "Требуется пользовательская проверка распознанной структуры.",
      });
      analysis = { file: file.name, size: file.size, visualAnalysis: ["компоненты", "карточки", "кнопки", "spacing", "radius", "layout"] };
    }

    for (const token of tokens) {
      await prisma.designToken.upsert({
        where: { projectId_group_name: { projectId, group: token.group, name: token.name } },
        create: { projectId, ...token, source: type },
        update: { value: token.value, source: type },
      });
    }
    for (const candidate of candidates) await createCandidate(projectId, candidate, type);
    await prisma.designImport.update({ where: { id: item.id }, data: { status: "completed", analysisJson: JSON.stringify(analysis) } });
    revalidatePath(`/projects/${projectId}/library`);
    return { ok: true as const, analysis };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось проанализировать импорт.";
    await prisma.designImport.update({ where: { id: item.id }, data: { status: "failed", error: message } });
    return { ok: false as const, error: message };
  }
}

async function createCandidate(projectId: string, candidate: ComponentCandidate, source: string, sourceScreenId?: string, sourceScreenVersionId?: string, sourceScreenName?: string) {
  const approved = await prisma.designComponent.findMany({ where: { projectId, approved: true } });
  const ranked = approved.map((component) => ({ component, score: componentSimilarity(candidate, component) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const score = best?.score ?? 0;
  const recommendation = score > 90 ? "reuse" : score >= 70 ? "review" : "create_draft";
  await prisma.componentSimilarityReport.create({
    data: {
      projectId,
      componentId: best?.component.id,
      candidateName: candidate.name,
      score,
      recommendation,
      reasonsJson: JSON.stringify(best ? [`Похож на ${best.component.name}`] : ["Похожих компонентов не найдено"]),
    },
  });
  if (score > 90 && best) {
    await prisma.designComponent.update({
      where: { id: best.component.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        screensUsedIn: appendUnique(best.component.screensUsedIn, sourceScreenId),
        usedInScreens: appendUnique(best.component.usedInScreens, sourceScreenName),
        projectsUsedIn: appendUnique(best.component.projectsUsedIn, projectId),
        similarityHistory: appendHistory(best.component.similarityHistory, { candidate: candidate.name, score, action: "reuse", at: new Date().toISOString(), screenId: sourceScreenId }),
      },
    });
    return;
  }
  const htmlLayout = candidate.layoutJson ? generateHtmlLayout(candidate.layoutJson, candidate.designSpec || "", []) : null;
  const flutterWidgetTree = candidate.layoutJson ? generateFlutterWidgetTree(candidate.layoutJson, candidate.designSpec || "", []) : null;
  await prisma.designComponent.create({
    data: {
      projectId,
      name: candidate.name,
      description: candidate.description || "",
      category: candidate.category || "Misc",
      preview: candidate.preview || (candidate.layoutJson ? "layout-json-wireframe" : null),
      screenshot: candidate.screenshot,
      layoutJson: candidate.layoutJson ? JSON.stringify(candidate.layoutJson) : null,
      htmlLayout,
      flutterWidgetTree,
      states: JSON.stringify(candidate.states || []),
      variants: JSON.stringify(candidate.variants || []),
      source,
      status: "draft",
      approved: false,
      createdBy: "ai",
      basedOnComponents: JSON.stringify(best ? [best.component.id] : []),
      creationReason: candidate.reason || "Подходящего компонента не найдено.",
      differences: best ? `Сходство ${score}%. Требуется решение пользователя.` : "Новый компонент.",
      imagePrompt: candidate.imagePrompt,
      designSpec: candidate.designSpec,
      usageGuidelines: candidate.usageGuidelines,
      accessibilityNotes: candidate.accessibilityNotes,
      sourceScreenId,
      sourceScreenVersionId,
      screensUsedIn: JSON.stringify([]),
      usedInScreens: JSON.stringify([]),
      projectsUsedIn: JSON.stringify([projectId]),
      similarityHistory: JSON.stringify([{ candidate: candidate.name, score, action: recommendation, at: new Date().toISOString(), screenId: sourceScreenId }]),
    },
  });
}

export async function processGeneratedComponents(projectId: string, candidates: ComponentCandidate[], sourceScreenId: string, sourceScreenVersionId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const screen = await prisma.screen.findFirst({ where: { id: sourceScreenId, projectId }, select: { name: true } });
  for (const candidate of candidates) await createCandidate(projectId, candidate, "ai_generate", sourceScreenId, sourceScreenVersionId, screen?.name);
  revalidatePath(`/projects/${projectId}/library`);
}

function flattenTokens(value: unknown, prefix = ""): Array<{ group: string; name: string; value: string }> {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => typeof child === "object" && child !== null
    ? flattenTokens(child, prefix ? `${prefix}.${key}` : key)
    : [{ group: inferTokenGroup(prefix || key), name: key, value: String(child) }]);
}

function inferTokenGroup(value: string) {
  const text = value.toLowerCase();
  if (text.includes("color")) return "Цвета";
  if (text.includes("font") || text.includes("text")) return "Типографика";
  if (text.includes("radius")) return "Радиусы";
  if (text.includes("space") || text.includes("padding")) return "Отступы";
  return "Прочее";
}

function inferCategory(name: string) {
  const text = name.toLowerCase();
  if (text.includes("button")) return "Buttons";
  if (text.includes("card")) return "Cards";
  if (text.includes("nav") || text.includes("bar")) return "Navigation";
  if (text.includes("input") || text.includes("field")) return "Inputs";
  if (text.includes("dialog")) return "Dialogs";
  if (text.includes("list")) return "Lists";
  if (text.includes("icon")) return "Icons";
  return "Widgets";
}

function parseList(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendUnique(value: string | null, item?: string) {
  const items = parseList(value).filter((entry): entry is string => typeof entry === "string");
  if (item && !items.includes(item)) items.push(item);
  return JSON.stringify(items);
}

function appendHistory(value: string | null, entry: Record<string, unknown>) {
  const items = parseList(value);
  items.push(entry);
  return JSON.stringify(items);
}
