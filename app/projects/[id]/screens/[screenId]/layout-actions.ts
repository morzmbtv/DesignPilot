"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createBlankLayout, parseLayoutJson, validateLayoutJson, type LayoutJson } from "@/lib/layout";
import { assertProjectAccess, assertScreenAccess, assertVersionAccess, requireUser } from "@/lib/security";
import { compileDesignModel } from "@/lib/idm/design-compiler";
import { applyLayoutToIdm, createIdmFromLegacy } from "@/lib/idm/legacy-converter";
import type { InternalDesignModel } from "@/lib/idm/types";

export async function saveCanvasIdmVersion(
  projectId: string,
  screenId: string,
  baseVersionId: string,
  nextIdm: InternalDesignModel,
) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  await assertVersionAccess(baseVersionId, user.id);

  const base = await prisma.screenVersion.findFirst({
    where: { id: baseVersionId, screenId, screen: { projectId } },
    include: {
      internalDesignModel: true,
      screen: { include: { project: { include: { rules: true, designTokens: true, projectAssets: { select: { id: true } } } } } },
    },
  });
  if (!base) return { ok: false as const, error: "Исходная версия не найдена." };

  const oldIdm = readVersionIdm(base);
  const oldAssetRefs = new Set(oldIdm.hierarchy.elements.flatMap((element) => element.content.assetRef ? [element.content.assetRef] : []));
  const validAssetRefs = new Set(base.screen.project.projectAssets.map((asset) => asset.id));
  const invalidNewAssetRef = nextIdm.hierarchy.elements
    .map((element) => element.content.assetRef)
    .find((assetRef): assetRef is string => Boolean(assetRef && !validAssetRefs.has(assetRef) && !oldAssetRefs.has(assetRef)));
  if (invalidNewAssetRef) return { ok: false as const, error: "Выбранный ассет не принадлежит этому проекту." };
  const lockedIds = new Set(oldIdm.hierarchy.elements.filter((element) => element.layout.locked).map((element) => element.id));
  const oldById = new Map(oldIdm.hierarchy.elements.map((element) => [element.id, element]));
  for (const id of Array.from(lockedIds)) {
    const previous = oldById.get(id);
    const next = nextIdm.hierarchy.elements.find((element) => element.id === id);
    if (previous && (!next || (next.layout.locked !== false && JSON.stringify(previous) !== JSON.stringify(next)))) {
      return { ok: false as const, error: `Заблокированный элемент «${previous.name}» был изменён. Сначала разблокируйте его.` };
    }
  }

  const idm: InternalDesignModel = {
    ...nextIdm,
    metadata: {
      ...nextIdm.metadata,
      version: base.versionNumber + 1,
      source: "manual",
    },
    exportMetadata: {
      ...nextIdm.exportMetadata,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      changeSummary: "Canvas Edit",
      userRequest: "Ручное редактирование на Canvas",
    },
  };
  const rules = base.screen.project.rules.map(({ category, name, value }) => ({ category, name, value }));
  let compiled;
  try {
    compiled = compileDesignModel(idm, rules);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? `Не удалось пересобрать экран: ${error.message}` : "Не удалось пересобрать экран.",
    };
  }
  if (JSON.stringify(oldIdm) === JSON.stringify(compiled.idm)) {
    return { ok: false as const, error: "Нет изменений для сохранения." };
  }

  const diff = summarizeIdmChanges(oldIdm, compiled.idm);
  const usedAssetIds = Array.from(new Set(compiled.idm.hierarchy.elements.flatMap((element) => element.content.assetRef ? [element.content.assetRef] : [])));
  const version = await prisma.$transaction(async (tx) => {
    const latest = await tx.screenVersion.findFirst({
      where: { screenId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    compiled.idm.metadata.version = versionNumber;
    const created = await tx.screenVersion.create({
      data: {
        screenId,
        versionNumber,
        userRequest: "Ручное редактирование на Canvas",
        designSpec: compiled.designSpec,
        imagePrompt: compiled.imagePrompt,
        layoutJson: JSON.stringify(compiled.layoutJson),
        htmlLayout: compiled.htmlLayout,
        flutterWidgetTree: compiled.flutterWidgetTree,
        changeSummary: "Canvas Edit",
        diff,
      },
      select: { id: true, versionNumber: true },
    });
    await tx.screenDesign.create({
      data: {
        projectId,
        screenId,
        screenVersionId: created.id,
        modelJson: JSON.stringify(compiled.idm),
        normalizedJson: JSON.stringify(compiled.idm),
        validationJson: JSON.stringify(compiled.validation),
      },
    });
    for (const assetId of usedAssetIds) {
      await tx.projectAsset.updateMany({ where: { id: assetId, projectId }, data: { usageCount: { increment: 1 } } });
    }
    return created;
  });

  revalidatePath(`/projects/${projectId}/screens/${screenId}`);
  return { ok: true as const, versionNumber: version.versionNumber };
}

export async function saveManualLayoutVersion(projectId: string, screenId: string, baseVersionId: string, layout: LayoutJson) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  await assertVersionAccess(baseVersionId, user.id);

  const validation = validateLayoutJson(layout);
  if (!validation.valid || !validation.layout) return { ok: false as const, error: validation.errors.join("; ") };

  const base = await prisma.screenVersion.findFirst({
    where: { id: baseVersionId, screenId, screen: { projectId } },
    include: { internalDesignModel: true, screen: { include: { project: { include: { rules: true, designTokens: true } } } } },
  });
  if (!base) return { ok: false as const, error: "Исходная версия не найдена." };

  const previous = parseLayoutJson(base.layoutJson).layout;
  const previousMap = new Map(previous?.elements.map((element) => [element.id, element]));
  const changed = layout.elements.filter((element) => JSON.stringify(previousMap.get(element.id)) !== JSON.stringify(element));
  const removed = previous?.elements.filter((element) => !layout.elements.some((candidate) => candidate.id === element.id)) ?? [];
  const layoutChanged = JSON.stringify(previous) !== JSON.stringify(layout);
  const codeRules = base.screen.project.rules.map(({ category, name, value }) => ({ category, name, value }));
  const baseIdm = readVersionIdm(base);
  const idm = applyLayoutToIdm(baseIdm, layout, "Manual layout edit", "Manual Wireframe Layout Editor change");
  const compiled = compileDesignModel(idm, codeRules);

  if (layoutChanged && compiled.imagePrompt === base.imagePrompt) {
    return { ok: false as const, error: "Промпт не обновился после изменения Layout. Версия не сохранена." };
  }

  const version = await prisma.$transaction(async (tx) => {
    const latest = await tx.screenVersion.findFirst({ where: { screenId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    const created = await tx.screenVersion.create({
      data: {
        screenId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        userRequest: "Manual Wireframe Layout Editor change",
        designSpec: compiled.designSpec,
        imagePrompt: compiled.imagePrompt,
        layoutJson: JSON.stringify(compiled.layoutJson),
        htmlLayout: compiled.htmlLayout,
        flutterWidgetTree: compiled.flutterWidgetTree,
        changeSummary: "Manual layout edit",
        diff: changed
          .map((element) => `${element.id}: label="${element.label}", x=${element.x}, y=${element.y}, ${element.width}×${element.height}, locked=${Boolean(element.locked)}`)
          .concat(removed.map((element) => `${element.id}: удалён`))
          .join("\n"),
      },
      select: { id: true, versionNumber: true },
    });
    await tx.screenDesign.create({
      data: {
        projectId,
        screenId,
        screenVersionId: created.id,
        modelJson: JSON.stringify(compiled.idm),
        normalizedJson: JSON.stringify(compiled.idm),
        validationJson: JSON.stringify(compiled.validation),
      },
    });
    return created;
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
    include: { internalDesignModel: true, screen: { include: { project: { include: { rules: true, designTokens: true } } } } },
  });
  if (!base) return { ok: false as const, error: "Версия экрана не найдена." };

  const parsed = layoutOverride ? validateLayoutJson(layoutOverride) : parseLayoutJson(base.layoutJson);
  if (!parsed.valid || !parsed.layout) {
    return { ok: false as const, error: base.layoutJson ? "Layout JSON невалиден, HTML/Flutter не может быть создан." : "Layout JSON отсутствует." };
  }

  const previous = parseLayoutJson(base.layoutJson).layout;
  const layoutChanged = JSON.stringify(previous) !== JSON.stringify(parsed.layout);
  const codeRules = base.screen.project.rules.map(({ category, name, value }) => ({ category, name, value }));
  const idm = applyLayoutToIdm(
    readVersionIdm(base),
    parsed.layout,
    htmlOverride ? "Manual HTML review with IDM-preserved layout" : "Design Code regenerated from IDM/Layout",
    htmlOverride ? "Ручное редактирование HTML Layout" : "Обновление Design Code из Layout JSON",
  );
  const compiled = compileDesignModel(idm, codeRules);
  const htmlLayout = htmlOverride?.trim() || compiled.htmlLayout;

  if (layoutChanged && compiled.imagePrompt === base.imagePrompt) {
    return { ok: false as const, error: "Промпт не обновился после изменения Layout. Версия не сохранена." };
  }

  const version = await prisma.$transaction(async (tx) => {
    const latest = await tx.screenVersion.findFirst({ where: { screenId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    const created = await tx.screenVersion.create({
      data: {
        screenId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        userRequest: htmlOverride ? "Ручное редактирование HTML Layout" : "Обновление Design Code из IDM/Layout",
        designSpec: compiled.designSpec,
        imagePrompt: compiled.imagePrompt,
        layoutJson: JSON.stringify(compiled.layoutJson),
        htmlLayout,
        flutterWidgetTree: compiled.flutterWidgetTree,
        newRulesJson: base.newRulesJson,
        changeSummary: htmlOverride ? "HTML Layout проверен; IDM сохранён" : "Design Code пересобран из IDM",
        diff: htmlOverride ? "HTML Layout изменён вручную; IDM и Layout JSON остаются источником истины." : "HTML Layout и Flutter Tree пересобраны Design Compiler.",
      },
      select: { id: true, versionNumber: true },
    });
    await tx.screenDesign.create({
      data: {
        projectId,
        screenId,
        screenVersionId: created.id,
        modelJson: JSON.stringify(compiled.idm),
        normalizedJson: JSON.stringify(compiled.idm),
        validationJson: JSON.stringify(compiled.validation),
      },
    });
    return created;
  });

  revalidatePath(`/projects/${projectId}/screens/${screenId}`);
  return { ok: true as const, versionNumber: version.versionNumber };
}

function readVersionIdm(base: {
  versionNumber: number;
  layoutJson: string | null;
  userRequest: string;
  changeSummary: string;
  internalDesignModel: { normalizedJson: string | null; modelJson: string } | null;
  screen: { name: string; project: { name: string; platform: string; designTokens: Array<{ group: string; name: string; value: string }> } };
}): InternalDesignModel {
  if (base.internalDesignModel?.normalizedJson) return JSON.parse(base.internalDesignModel.normalizedJson);
  if (base.internalDesignModel?.modelJson) return JSON.parse(base.internalDesignModel.modelJson);
  return createIdmFromLegacy({
    projectName: base.screen.project.name,
    screenName: base.screen.name,
    platform: base.screen.project.platform,
    versionNumber: base.versionNumber,
    layoutJson: base.layoutJson,
    userRequest: base.userRequest,
    changeSummary: base.changeSummary,
    source: "legacy_migration",
    tokens: base.screen.project.designTokens.map(({ group, name, value }) => ({ group, name, value })),
  });
}

function summarizeIdmChanges(previous: InternalDesignModel, next: InternalDesignModel) {
  const oldById = new Map(previous.hierarchy.elements.map((element) => [element.id, element]));
  const nextIds = new Set(next.hierarchy.elements.map((element) => element.id));
  const lines = next.hierarchy.elements.flatMap((element) => {
    const old = oldById.get(element.id);
    if (!old) return [`${element.id}: добавлен`];
    if (JSON.stringify(old) === JSON.stringify(element)) return [];
    return [`${element.id}: обновлён (x=${element.layout.x}, y=${element.layout.y}, ${element.layout.width}×${element.layout.height}, z=${element.layout.zIndex ?? 0}, visible=${element.layout.visible !== false}, locked=${Boolean(element.layout.locked)})`];
  });
  for (const element of previous.hierarchy.elements) {
    if (!nextIds.has(element.id)) lines.push(`${element.id}: удалён`);
  }
  return lines.join("\n") || "Canvas Edit";
}
