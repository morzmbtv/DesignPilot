"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBlankLayout, parseLayoutJson, validateLayoutJson, type LayoutJson } from "@/lib/layout";
import { generateHtmlLayout } from "@/lib/design-code/html-layout-generator";
import { generateFlutterWidgetTree } from "@/lib/design-code/flutter-tree-generator";
import { assertProjectAccess, assertScreenAccess, assertVersionAccess, requireUser } from "@/lib/security";

export async function saveManualLayoutVersion(projectId: string, screenId: string, baseVersionId: string, layout: LayoutJson) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  await assertVersionAccess(baseVersionId, user.id);
  const validation = validateLayoutJson(layout);
  if (!validation.valid || !validation.layout) return { ok: false as const, error: validation.errors.join("; ") };
  const base = await prisma.screenVersion.findFirst({
    where: { id: baseVersionId, screenId, screen: { projectId } },
    include: { screen: { include: { project: { include: { rules: true } } } } },
  });
  if (!base) return { ok: false as const, error: "Исходная версия не найдена." };
  const previous = parseLayoutJson(base.layoutJson).layout;
  const previousMap = new Map(previous?.elements.map((element) => [element.id, element]));
  const changed = layout.elements.filter((element) => JSON.stringify(previousMap.get(element.id)) !== JSON.stringify(element));
  const removed = previous?.elements.filter((element) => !layout.elements.some((candidate) => candidate.id === element.id)) ?? [];
  const layoutChanged = JSON.stringify(previous) !== JSON.stringify(layout);
  const date = new Date().toISOString();
  const specOverrides = changed.map((element) => `- element [${element.id}] “${element.label}”: x=${element.x}, y=${element.y}, width=${element.width}, height=${element.height}, locked=${Boolean(element.locked)}\n- reason: manually edited in Wireframe Layout Editor\n- date: ${date}`).concat(removed.map((element) => `- element [${element.id}] removed\n- reason: manually edited in Wireframe Layout Editor\n- date: ${date}`)).join("\n");
  const promptOverrides = changed.map((element) => `- element [${element.id}] “${element.label}” must be exactly at x=${element.x}, y=${element.y}, width=${element.width}, height=${element.height}, locked=${Boolean(element.locked)}`).concat(removed.map((element) => `- remove element [${element.id}] “${element.label}”`)).join("\n");
  const designSpec = `${base.designSpec}\n\nMANUAL_LAYOUT_OVERRIDES:\n${specOverrides || "- layout JSON reviewed without coordinate changes"}`;
  const imagePrompt = `${base.imagePrompt}\n\nSTRICT LAYOUT OVERRIDES:\n${promptOverrides || "- follow the attached Layout JSON exactly"}\n- preserve all other elements unless explicitly changed\n- do not reinterpret the screen\n- do not redesign the screen\n- follow the Design Spec and Layout JSON exactly`;
  if (layoutChanged && imagePrompt === base.imagePrompt) return { ok: false as const, error: "Промпт не обновился после изменения Layout. Версия не сохранена." };
  const codeRules = base.screen.project.rules.map(({ category, name, value }) => ({ category, name, value }));
  const htmlLayout = generateHtmlLayout(layout, designSpec, codeRules);
  const flutterWidgetTree = generateFlutterWidgetTree(layout, designSpec, codeRules);
  const version = await prisma.$transaction(async (tx) => {
    const latest = await tx.screenVersion.findFirst({ where: { screenId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    return tx.screenVersion.create({
      data: {
        screenId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        userRequest: "Manual Wireframe Layout Editor change",
        designSpec,
        imagePrompt,
        layoutJson: JSON.stringify(layout),
        htmlLayout,
        flutterWidgetTree,
        changeSummary: "Manual layout edit",
        diff: changed.map((element) => `${element.id}: label="${element.label}", x=${element.x}, y=${element.y}, ${element.width}×${element.height}, locked=${Boolean(element.locked)}`).concat(removed.map((element) => `${element.id}: удалён`)).join("\n"),
      },
      select: { id: true, versionNumber: true },
    });
  });
  revalidatePath(`/projects/${projectId}/screens/${screenId}`);
  return { ok: true as const, versionNumber: version.versionNumber };
}

export async function generateFallbackLayout(projectId: string, screenId: string, baseVersionId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  await assertVersionAccess(baseVersionId, user.id);
  const screen = await prisma.screen.findFirst({ where: { id: screenId, projectId }, select: { name: true } });
  if (!screen) return { ok: false as const, error: "Экран не найден." };
  return saveManualLayoutVersion(projectId, screenId, baseVersionId, createBlankLayout(screen.name));
}

export async function saveDesignCodeVersion(projectId: string, screenId: string, baseVersionId: string, htmlOverride?: string, layoutOverride?: LayoutJson) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  await assertVersionAccess(baseVersionId, user.id);
  const base = await prisma.screenVersion.findFirst({
    where: { id: baseVersionId, screenId, screen: { projectId } },
    include: { screen: { include: { project: { include: { rules: true } } } } },
  });
  if (!base) return { ok: false as const, error: "Версия экрана не найдена." };
  const parsed = layoutOverride ? validateLayoutJson(layoutOverride) : parseLayoutJson(base.layoutJson);
  if (!parsed.valid || !parsed.layout) {
    return { ok: false as const, error: base.layoutJson ? "Layout JSON невалиден, HTML/Flutter не может быть создан." : "Layout JSON отсутствует." };
  }
  const rules = base.screen.project.rules.map(({ category, name, value }) => ({ category, name, value }));
  const generatedHtml = generateHtmlLayout(parsed.layout, base.designSpec, rules);
  const flutterWidgetTree = generateFlutterWidgetTree(parsed.layout, base.designSpec, rules);
  const htmlLayout = htmlOverride?.trim() || generatedHtml;
  const previous = parseLayoutJson(base.layoutJson).layout;
  const layoutChanged = JSON.stringify(previous) !== JSON.stringify(parsed.layout);
  const synchronizedPrompt = layoutChanged
    ? `${base.imagePrompt}\n\nSTRICT LAYOUT OVERRIDES:\n${parsed.layout.elements.map((element) => `- element [${element.id}] “${element.label}” must be exactly at x=${element.x}, y=${element.y}, width=${element.width}, height=${element.height}, locked=${Boolean(element.locked)}`).join("\n")}\n- preserve all other elements unless explicitly changed\n- follow the Layout JSON exactly`
    : base.imagePrompt;
  if (layoutChanged && synchronizedPrompt === base.imagePrompt) return { ok: false as const, error: "Промпт не обновился после изменения Layout. Версия не сохранена." };
  const version = await prisma.$transaction(async (tx) => {
    const latest = await tx.screenVersion.findFirst({ where: { screenId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    return tx.screenVersion.create({
      data: {
        screenId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        userRequest: htmlOverride ? "Ручное редактирование HTML Layout" : "Обновление Design Code из Layout JSON",
        designSpec: base.designSpec,
        imagePrompt: synchronizedPrompt,
        layoutJson: JSON.stringify(parsed.layout),
        htmlLayout,
        flutterWidgetTree,
        newRulesJson: base.newRulesJson,
        changeSummary: htmlOverride ? "Ручное редактирование HTML Layout" : "Design Code обновлён из Layout JSON",
        diff: htmlOverride ? "HTML Layout изменён вручную; Layout JSON не изменялся." : "HTML Layout и Flutter Tree пересобраны детерминированно.",
      },
      select: { versionNumber: true },
    });
  });
  revalidatePath(`/projects/${projectId}/screens/${screenId}`);
  return { ok: true as const, versionNumber: version.versionNumber };
}
