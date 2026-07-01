"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assetTypeToIdmType, isProjectAssetType, type ProjectAssetType } from "@/lib/assets";
import { assertProjectAccess, assertScreenAccess, requireUser } from "@/lib/security";
import { compileDesignModel } from "@/lib/idm/design-compiler";
import { createIdmFromLegacy } from "@/lib/idm/legacy-converter";
import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";
import { generateImageAsset, OpenRouterImageError } from "@/lib/ai/openrouter-image";
import { validateAssetBytes } from "@/lib/asset-validation";

type ActionResult = { ok: true; message: string; assetId?: string; versionNumber?: number } | { ok: false; error: string };

export async function uploadProjectAsset(projectId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const file = formData.get("file");
  const typeValue = String(formData.get("type") || "other");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Выберите файл." };
  if (!isProjectAssetType(typeValue)) return { ok: false, error: "Некорректный тип ассета." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const validationError = validateAssetBytes(bytes, file.type, file.size);
  if (validationError) return { ok: false, error: validationError };

  const makePrimary = formData.get("isPrimaryLogo") === "on";
  if (makePrimary && typeValue !== "logo") return { ok: false, error: "Основным логотипом может быть только ассет типа «Логотип»." };
  const width = positiveInteger(formData.get("width"));
  const height = positiveInteger(formData.get("height"));
  const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
  const name = String(formData.get("name") || file.name).trim() || file.name;

  const asset = await prisma.$transaction(async (tx) => {
    if (makePrimary) await tx.projectAsset.updateMany({ where: { projectId }, data: { isPrimaryLogo: false } });
    return tx.projectAsset.create({
      data: {
        userId: user.id,
        projectId,
        name,
        type: typeValue,
        source: "uploaded",
        mimeType: file.type,
        fileName: file.name,
        fileSize: file.size,
        width,
        height,
        dataUrl,
        isPrimaryLogo: makePrimary,
        isBrandAsset: formData.get("isBrandAsset") === "on" || makePrimary,
      },
      select: { id: true },
    });
  });
  revalidateAssets(projectId);
  return { ok: true, message: "Ассет загружен.", assetId: asset.id };
}

export async function setPrimaryProjectLogo(projectId: string, assetId: string): Promise<ActionResult> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const asset = await prisma.projectAsset.findFirst({ where: { id: assetId, projectId, userId: user.id }, select: { id: true, type: true } });
  if (!asset) return { ok: false, error: "Ассет не найден." };
  if (asset.type !== "logo") return { ok: false, error: "Основным логотипом может быть только ассет типа «Логотип»." };
  await prisma.$transaction([
    prisma.projectAsset.updateMany({ where: { projectId }, data: { isPrimaryLogo: false } }),
    prisma.projectAsset.update({ where: { id: asset.id }, data: { isPrimaryLogo: true, isBrandAsset: true } }),
  ]);
  revalidateAssets(projectId);
  return { ok: true, message: "Основной логотип обновлён." };
}

export async function deleteProjectAsset(projectId: string, assetId: string): Promise<ActionResult> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const asset = await prisma.projectAsset.findFirst({ where: { id: assetId, projectId, userId: user.id }, select: { id: true } });
  if (!asset) return { ok: false, error: "Ассет не найден." };
  await prisma.projectAsset.delete({ where: { id: asset.id } });
  revalidateAssets(projectId);
  return { ok: true, message: "Ассет удалён из библиотеки." };
}

export async function generateProjectAsset(projectId: string, input: {
  name: string; type: string; description: string; useProjectStyle: boolean;
}): Promise<ActionResult> {
  if (!isProjectAssetType(input.type)) return { ok: false, error: "Некорректный тип ассета." };
  if (!input.description.trim()) return { ok: false, error: "Опишите ассет, который нужно создать." };
  try {
    const asset = await generateImageAsset(projectId, input.description, input.type, {
      name: input.name,
      useProjectStyle: input.useProjectStyle,
    });
    revalidateAssets(projectId);
    return { ok: true, message: "Ассет сгенерирован.", assetId: asset.id };
  } catch (error) {
    return { ok: false, error: error instanceof OpenRouterImageError ? error.message : "Не удалось сгенерировать ассет." };
  }
}

export async function addProjectAssetToScreen(projectId: string, assetId: string, screenId: string): Promise<ActionResult> {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);
  const [asset, screen] = await Promise.all([
    prisma.projectAsset.findFirst({ where: { id: assetId, projectId, userId: user.id } }),
    prisma.screen.findFirst({
      where: { id: screenId, projectId, project: { userId: user.id } },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { internalDesignModel: true } },
        project: { include: { rules: true, designTokens: true } },
      },
    }),
  ]);
  if (!asset) return { ok: false, error: "Ассет не найден." };
  if (!screen) return { ok: false, error: "Экран не найден." };
  const base = screen.versions[0];
  if (!base) return { ok: false, error: "Сначала создайте первую версию экрана." };
  const idm = readVersionIdm(base, screen);
  const element = createAssetElement(idm, asset);
  const rootId = idm.hierarchy.rootId;
  const nextIdm: InternalDesignModel = {
    ...idm,
    metadata: { ...idm.metadata, source: "manual" },
    hierarchy: {
      ...idm.hierarchy,
      elements: idm.hierarchy.elements
        .map((item) => item.id === rootId ? { ...item, children: [...item.children, element.id] } : item)
        .concat(element),
    },
    exportMetadata: {
      ...idm.exportMetadata,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      changeSummary: `Ассет «${asset.name}» добавлен на Canvas`,
      userRequest: `Добавить ассет ${asset.name}`,
    },
  };
  const rules = screen.project.rules.map(({ category, name, value }) => ({ category, name, value }));
  const compiled = compileDesignModel(nextIdm, rules);
  const version = await prisma.$transaction(async (tx) => {
    const latest = await tx.screenVersion.findFirst({ where: { screenId }, orderBy: { versionNumber: "desc" }, select: { versionNumber: true } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    compiled.idm.metadata.version = versionNumber;
    const created = await tx.screenVersion.create({
      data: {
        screenId,
        versionNumber,
        userRequest: `Добавить ассет ${asset.name}`,
        designSpec: compiled.designSpec,
        imagePrompt: compiled.imagePrompt,
        layoutJson: JSON.stringify(compiled.layoutJson),
        htmlLayout: compiled.htmlLayout,
        flutterWidgetTree: compiled.flutterWidgetTree,
        changeSummary: "Canvas Edit",
        diff: `${element.id}: добавлен assetRef=${asset.id}`,
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
    await tx.projectAsset.update({ where: { id: asset.id }, data: { usageCount: { increment: 1 } } });
    return created;
  });
  revalidatePath(`/projects/${projectId}/screens/${screenId}`);
  revalidateAssets(projectId);
  return { ok: true, message: `Ассет добавлен на экран «${screen.name}».`, versionNumber: version.versionNumber };
}

function createAssetElement(idm: InternalDesignModel, asset: {
  id: string; name: string; type: string; width: number | null; height: number | null; isPrimaryLogo: boolean;
}): IdmElement {
  const type = asset.type as ProjectAssetType;
  const id = uniqueId(idm, `asset_${slug(asset.name)}`);
  const sourceWidth = asset.width || 200;
  const sourceHeight = asset.height || 200;
  const width = Math.min(260, sourceWidth);
  const height = Math.max(4, Math.round(width * sourceHeight / sourceWidth));
  const zIndex = Math.max(0, ...idm.hierarchy.elements.map((element) => element.layout.zIndex ?? 0)) + 1;
  return {
    id,
    type: assetTypeToIdmType(type),
    name: asset.name,
    parent: idm.hierarchy.rootId,
    children: [],
    layout: { x: 20, y: 120, width, height, zIndex, visible: true, locked: false, radius: 0 },
    style: { background: "transparent", opacity: 1 },
    animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
    constraints: ["editor:rotation=0", "asset:preserve-reference"],
    behavior: [],
    semanticRole: type === "logo" ? "logo" : "image",
    content: { text: asset.name, alt: asset.name, assetRef: asset.id, assetRole: asset.isPrimaryLogo ? "primaryLogo" : type },
    componentRef: null,
    state: {},
  };
}

function readVersionIdm(
  version: {
    versionNumber: number; layoutJson: string | null; userRequest: string; changeSummary: string;
    internalDesignModel: { normalizedJson: string | null; modelJson: string } | null;
  },
  screen: { name: string; project: { name: string; platform: string; designTokens: Array<{ group: string; name: string; value: string }> } },
): InternalDesignModel {
  if (version.internalDesignModel?.normalizedJson) return JSON.parse(version.internalDesignModel.normalizedJson) as InternalDesignModel;
  if (version.internalDesignModel?.modelJson) return JSON.parse(version.internalDesignModel.modelJson) as InternalDesignModel;
  return createIdmFromLegacy({
    projectName: screen.project.name,
    screenName: screen.name,
    platform: screen.project.platform,
    versionNumber: version.versionNumber,
    layoutJson: version.layoutJson,
    userRequest: version.userRequest,
    changeSummary: version.changeSummary,
    source: "legacy_migration",
    tokens: screen.project.designTokens.map(({ group, name, value }) => ({ group, name, value })),
  });
}

function positiveInteger(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function uniqueId(idm: InternalDesignModel, prefix: string) {
  const ids = new Set(idm.hierarchy.elements.map((element) => element.id));
  if (!ids.has(prefix)) return prefix;
  let index = 2;
  while (ids.has(`${prefix}_${index}`)) index++;
  return `${prefix}_${index}`;
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "_").replace(/^_+|_+$/g, "") || "asset";
}
function revalidateAssets(projectId: string) {
  revalidatePath(`/projects/${projectId}/assets`);
  revalidatePath(`/projects/${projectId}`);
}
