import { createBlankLayout, parseLayoutJson, type LayoutElement, type LayoutJson } from "@/lib/layout";
import { IDM_COMPILER_VERSION, type IdmElement, type InternalDesignModel } from "@/lib/idm/types";
import { writeEditorProperties } from "@/lib/idm/editor-properties";

type LegacyInput = {
  projectName: string;
  screenName: string;
  platform?: string;
  versionNumber: number;
  layoutJson?: string | LayoutJson | null;
  userRequest?: string;
  changeSummary?: string;
  source?: InternalDesignModel["metadata"]["source"];
  tokens?: Array<{ group: string; name: string; value: string }>;
};

export function createIdmFromLegacy(input: LegacyInput): InternalDesignModel {
  const layout = readLayout(input.layoutJson, input.screenName);
  const rootId = "screen_root";
  const now = new Date().toISOString();
  return {
    metadata: {
      id: `idm_${slug(input.screenName)}_${input.versionNumber}`,
      screenName: input.screenName,
      project: input.projectName,
      version: input.versionNumber,
      viewport: {
        width: layout.viewport.width,
        height: layout.viewport.height,
        safeAreaTop: layout.viewport.width <= 430 ? 44 : 0,
        pagePadding: layout.viewport.width >= 768 ? 32 : 20,
      },
      platform: input.platform || "ios",
      source: input.source || "legacy_migration",
      compilerVersion: IDM_COMPILER_VERSION,
    },
    hierarchy: {
      rootId,
      elements: [
        {
          id: rootId,
          type: "section",
          name: input.screenName,
          parent: null,
          children: layout.elements.map((element) => element.id),
          layout: { x: 0, y: 0, width: layout.viewport.width, height: layout.viewport.height, visible: true, zIndex: 0 },
          style: { background: "#FFFFFF", opacity: 1 },
          animation: defaultAnimation(),
          constraints: [`viewport:${layout.viewport.width}x${layout.viewport.height}`],
          behavior: [],
          semanticRole: "screen",
          content: { text: input.screenName },
          componentRef: null,
        },
        ...layout.elements.map((element) => elementToIdm(element, rootId)),
      ],
    },
    theme: { tokens: input.tokens ?? [], colorMode: "light" },
    motion: { defaultAnimation: defaultAnimation() },
    interactions: [],
    dataBinding: [],
    accessibility: { notes: ["Минимальный размер интерактивной зоны 44×44 px."], minimumTapTarget: 44 },
    componentSuggestions: [],
    exportMetadata: {
      createdBy: input.source === "manual" ? "user" : input.source === "ai" ? "ai" : "system",
      createdAt: now,
      changeSummary: input.changeSummary || "IDM создан из существующего Layout JSON",
      userRequest: input.userRequest,
    },
  };
}

export function applyLayoutToIdm(base: InternalDesignModel, layout: LayoutJson, changeSummary: string, userRequest: string): InternalDesignModel {
  const rootId = base.hierarchy.rootId || "screen_root";
  const oldElements = new Map(base.hierarchy.elements.map((element) => [element.id, element]));
  return {
    ...base,
    metadata: {
      ...base.metadata,
      source: "manual",
      compilerVersion: IDM_COMPILER_VERSION,
    },
    hierarchy: {
      rootId,
      elements: [
        {
          ...(oldElements.get(rootId) ?? elementToIdm({ id: rootId, type: "section", label: base.metadata.screenName, x: 0, y: 0, width: layout.viewport.width, height: layout.viewport.height }, null)),
          id: rootId,
          parent: null,
          children: layout.elements.map((element) => element.id),
          layout: { x: 0, y: 0, width: layout.viewport.width, height: layout.viewport.height, visible: true, zIndex: 0 },
        },
        ...layout.elements.map((element) => ({
          ...(oldElements.get(element.id) ?? elementToIdm(element, rootId)),
          ...elementToIdm(element, rootId),
        })),
      ],
    },
    exportMetadata: {
      ...base.exportMetadata,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      changeSummary,
      userRequest,
    },
  };
}

function readLayout(value: LegacyInput["layoutJson"], screenName: string) {
  if (!value) return createBlankLayout(screenName);
  if (typeof value === "string") return parseLayoutJson(value).layout ?? createBlankLayout(screenName);
  return value;
}

function elementToIdm(element: LayoutElement, parent: string | null): IdmElement {
  const idmElement: IdmElement = {
    id: element.id,
    type: element.type,
    name: element.label || element.id,
    parent,
    children: [],
    layout: {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      align: element.align || "left",
      radius: element.radius ?? 0,
      zIndex: element.zIndex ?? 1,
      visible: true,
      locked: Boolean(element.locked),
    },
    style: {
      background: element.background || "transparent",
      opacity: element.opacity ?? 1,
      typography: element.style || "default",
      color: element.color,
    },
    animation: defaultAnimation(),
    constraints: [],
    behavior: element.type === "button" ? ["tap"] : [],
    semanticRole: semanticRole(element.type),
    content: { text: element.label || element.id, assetRef: element.assetRef, assetRole: element.assetRole },
    componentRef: element.componentRef ? {
      componentId: element.componentRef,
      name: element.componentRef,
      source: "approved_library",
    } : null,
    state: {},
  };
  return writeEditorProperties(idmElement, {
    rotation: element.rotation ?? 0,
    fontFamily: element.fontFamily || "",
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    textAlign: element.align === "center" || element.align === "right" ? element.align : "left",
  });
}

function defaultAnimation() {
  return { type: "none" as const, durationMs: 0, curve: "linear", delayMs: 0 };
}

function semanticRole(type: LayoutElement["type"]) {
  if (type === "button") return "button";
  if (type === "input") return "input";
  if (type === "bottomNav") return "navigation";
  if (type === "image" || type === "illustration") return "image";
  if (type === "background") return "background";
  if (type === "decoration") return "decoration";
  if (type === "character") return "character";
  return type === "text" ? "text" : "group";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "_").replace(/^_+|_+$/g, "") || "screen";
}
