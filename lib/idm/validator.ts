import { layoutElementTypes } from "@/lib/layout";
import { IDM_COMPILER_VERSION, type IdmCompilerValidation, type IdmElement, type InternalDesignModel } from "@/lib/idm/types";

export function normalizeAndValidateIdm(input: unknown): { idm: InternalDesignModel | null; validation: IdmCompilerValidation } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const repaired: string[] = [];
  if (!isRecord(input)) return { idm: null, validation: { ok: false, errors: ["IDM должен быть JSON-объектом."], warnings, repaired } };

  const metadata = isRecord(input.metadata) ? input.metadata : {};
  const hierarchy = isRecord(input.hierarchy) ? input.hierarchy : {};
  const rawElements = Array.isArray(hierarchy.elements) ? hierarchy.elements : [];
  const screenName = stringValue(metadata.screenName, "Screen");
  const rootId = stringValue(hierarchy.rootId, "screen_root");
  if (!input.metadata) repaired.push("Добавлен metadata.");
  if (!input.hierarchy) repaired.push("Добавлен hierarchy.");
  if (!rawElements.length) warnings.push("IDM не содержит элементов; добавлен root screen.");

  const elements = rawElements.flatMap((item, index) => normalizeElement(item, index, rootId, errors, warnings, repaired));
  if (!elements.some((element) => element.id === rootId)) {
    elements.unshift({
      id: rootId,
      type: "section",
      name: screenName,
      parent: null,
      children: elements.map((element) => element.id),
      layout: { x: 0, y: 0, width: 390, height: 844, visible: true, zIndex: 0 },
      style: { background: "#FFFFFF", opacity: 1 },
      animation: defaultAnimation(),
      constraints: ["viewport:390x844"],
      behavior: [],
      semanticRole: "screen",
      content: { text: screenName },
      componentRef: null,
      state: {},
    });
    repaired.push("Добавлен корневой элемент screen_root.");
  }

  const ids = new Set<string>();
  for (const element of elements) {
    if (ids.has(element.id)) errors.push(`Повторяющийся id элемента: ${element.id}.`);
    ids.add(element.id);
  }
  for (const element of elements) {
    if (element.parent && !ids.has(element.parent)) {
      warnings.push(`Битая parent-ссылка у ${element.id}: ${element.parent}. Parent сброшен на ${rootId}.`);
      element.parent = rootId;
      repaired.push(`Восстановлен parent для ${element.id}.`);
    }
    element.children = element.children.filter((childId) => {
      const exists = ids.has(childId);
      if (!exists) warnings.push(`Удалена битая child-ссылка ${element.id} → ${childId}.`);
      return exists;
    });
  }
  detectCycles(elements, errors);

  const idm: InternalDesignModel = {
    metadata: {
      id: stringValue(metadata.id, `idm_${Date.now()}`),
      screenName,
      project: stringValue(metadata.project, "DesignPilot Project"),
      version: numberValue(metadata.version, 1),
      viewport: normalizeViewport(metadata.viewport, repaired),
      platform: stringValue(metadata.platform, "iOS и Android"),
      source: sourceValue(metadata.source),
      compilerVersion: IDM_COMPILER_VERSION,
    },
    hierarchy: { rootId, elements },
    theme: {
      tokens: Array.isArray((input as Record<string, unknown>).theme && (input as any).theme.tokens)
        ? (input as any).theme.tokens.map((token: unknown) => normalizeToken(token)).filter(Boolean)
        : [],
      typography: isRecord((input as any).theme) ? stringOrUndefined((input as any).theme.typography) : undefined,
      colorMode: "light",
    },
    motion: {
      defaultAnimation: defaultAnimation(),
      screenTransition: isRecord((input as any).motion?.screenTransition) ? normalizeAnimation((input as any).motion.screenTransition, repaired) : undefined,
    },
    interactions: Array.isArray((input as any).interactions) ? (input as any).interactions.filter(isRecord).map((item: Record<string, unknown>) => ({
      elementId: stringValue(item.elementId, rootId),
      trigger: triggerValue(item.trigger),
      action: stringValue(item.action, "none"),
      haptic: stringOrUndefined(item.haptic),
    })) : [],
    dataBinding: Array.isArray((input as any).dataBinding) ? (input as any).dataBinding.filter(isRecord).map((item: Record<string, unknown>) => ({
      elementId: stringValue(item.elementId, rootId),
      binding: stringValue(item.binding, ""),
    })) : [],
    accessibility: {
      notes: Array.isArray((input as any).accessibility?.notes) ? (input as any).accessibility.notes.map(String) : ["Проверить читаемость текста и touch targets."],
      minimumTapTarget: numberValue((input as any).accessibility?.minimumTapTarget, 44),
    },
    componentSuggestions: Array.isArray((input as any).componentSuggestions) ? (input as any).componentSuggestions.filter(isRecord).map(normalizeComponentSuggestion) : [],
    exportMetadata: {
      createdBy: createdByValue((input as any).exportMetadata?.createdBy),
      createdAt: stringValue((input as any).exportMetadata?.createdAt, new Date().toISOString()),
      changeSummary: stringValue((input as any).exportMetadata?.changeSummary, "IDM скомпилирован"),
      userRequest: stringOrUndefined((input as any).exportMetadata?.userRequest),
    },
  };

  return { idm, validation: { ok: errors.length === 0, errors, warnings, repaired } };
}

function normalizeElement(item: unknown, index: number, rootId: string, errors: string[], warnings: string[], repaired: string[]): IdmElement[] {
  if (!isRecord(item)) {
    errors.push(`hierarchy.elements[${index}] должен быть объектом.`);
    return [];
  }
  const type = layoutElementTypes.includes(item.type as any) ? item.type as IdmElement["type"] : "section";
  if (type === "section" && item.type && !layoutElementTypes.includes(item.type as any)) repaired.push(`Тип элемента ${String(item.type)} заменён на section.`);
  const id = stringValue(item.id, `element_${index + 1}`);
  const layout = isRecord(item.layout) ? item.layout : {};
  const style = isRecord(item.style) ? item.style : {};
  const content = isRecord(item.content) ? item.content : {};
  const width = Math.max(4, numberValue(layout.width, type === "text" ? 180 : 350));
  const height = Math.max(4, numberValue(layout.height, type === "text" ? 32 : 56));
  const x = numberValue(layout.x, 20);
  const y = numberValue(layout.y, 120 + index * 68);
  if (x < -20 || y < -20 || x + width > 410 || y + height > 864) warnings.push(`Элемент ${id} выходит за допустимые границы viewport.`);
  if (!item.style) repaired.push(`Для ${id} добавлен style.`);
  if (!item.animation) repaired.push(`Для ${id} добавлен animation.`);
  if (!item.content) repaired.push(`Для ${id} добавлен content.`);
  return [{
    id,
    type,
    name: stringValue(item.name, stringValue(content.text, id)),
    parent: item.parent === null ? null : stringValue(item.parent, rootId),
    children: Array.isArray(item.children) ? item.children.map(String) : [],
    layout: {
      x,
      y,
      width,
      height,
      align: stringValue(layout.align, "left"),
      radius: numberValue(layout.radius, type === "button" ? 14 : 0),
      zIndex: numberValue(layout.zIndex, index + 1),
      visible: typeof layout.visible === "boolean" ? layout.visible : true,
      locked: Boolean(layout.locked),
    },
    style: {
      background: stringValue(style.background, "transparent"),
      opacity: numberValue(style.opacity, 1),
      typography: stringValue(style.typography, "default"),
      color: stringOrUndefined(style.color),
      elevation: stringOrUndefined(style.elevation),
      tokenRefs: Array.isArray(style.tokenRefs) ? style.tokenRefs.map(String) : [],
    },
    animation: normalizeAnimation(item.animation, repaired),
    constraints: Array.isArray(item.constraints) ? item.constraints.map(String) : [],
    behavior: Array.isArray(item.behavior) ? item.behavior.map(String) : [],
    semanticRole: stringValue(item.semanticRole, defaultSemanticRole(type)),
    content: {
      text: stringValue(content.text, stringValue(item.name, id)),
      alt: stringOrUndefined(content.alt),
      assetRef: stringOrUndefined(content.assetRef),
      assetRole: stringOrUndefined(content.assetRole),
      icon: stringOrUndefined(content.icon),
    },
    componentRef: isRecord(item.componentRef) ? {
      componentId: stringValue(item.componentRef.componentId, ""),
      name: stringValue(item.componentRef.name, ""),
      source: item.componentRef.source === "draft_component" ? "draft_component" : "approved_library",
    } : null,
    state: isRecord(item.state) ? {
      loading: Boolean(item.state.loading),
      disabled: Boolean(item.state.disabled),
      pressed: Boolean(item.state.pressed),
      focused: Boolean(item.state.focused),
      skeleton: Boolean(item.state.skeleton),
      shimmer: Boolean(item.state.shimmer),
    } : {},
  }];
}

function detectCycles(elements: IdmElement[], errors: string[]) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const element of elements) {
    const seen = new Set<string>();
    let current: IdmElement | undefined = element;
    while (current?.parent) {
      if (seen.has(current.parent)) {
        errors.push(`Обнаружен цикл в иерархии около ${element.id}.`);
        break;
      }
      seen.add(current.parent);
      current = byId.get(current.parent);
    }
  }
}

function normalizeViewport(value: unknown, repaired: string[]) {
  const viewport = isRecord(value) ? value : {};
  if (viewport.width !== 390 || viewport.height !== 844) repaired.push("Viewport нормализован до 390×844.");
  return {
    width: 390 as const,
    height: 844 as const,
    safeAreaTop: numberValue(viewport.safeAreaTop, 44),
    pagePadding: numberValue(viewport.pagePadding, 20),
    bottomNavArea: typeof viewport.bottomNavArea === "number" ? viewport.bottomNavArea : undefined,
  };
}

function normalizeAnimation(value: unknown, repaired: string[]) {
  if (!isRecord(value)) return defaultAnimation();
  const type = ["none", "fade", "scale", "slide", "hero", "sharedTransition"].includes(String(value.type)) ? value.type as any : "none";
  if (type === "none" && value.type && value.type !== "none") repaired.push(`Animation ${String(value.type)} заменена на none.`);
  return {
    type,
    durationMs: numberValue(value.durationMs, type === "none" ? 0 : 240),
    curve: stringValue(value.curve, "easeOut"),
    delayMs: numberValue(value.delayMs, 0),
  };
}

function normalizeToken(value: unknown) {
  if (!isRecord(value)) return null;
  const group = stringValue(value.group, "");
  const name = stringValue(value.name, "");
  const tokenValue = stringValue(value.value, "");
  return group && name && tokenValue ? { group, name, value: tokenValue } : null;
}

function normalizeComponentSuggestion(value: Record<string, unknown>) {
  return {
    name: stringValue(value.name, "Новый компонент"),
    description: stringValue(value.description, ""),
    category: stringValue(value.category, "Misc"),
    basedOnComponentIds: Array.isArray(value.basedOnComponentIds) ? value.basedOnComponentIds.map(String) : [],
    reason: stringValue(value.reason, ""),
    elementIds: Array.isArray(value.elementIds) ? value.elementIds.map(String) : [],
    states: Array.isArray(value.states) ? value.states.map(String) : ["default"],
    variants: Array.isArray(value.variants) ? value.variants.map(String) : [],
    usageGuidelines: stringValue(value.usageGuidelines, ""),
    accessibilityNotes: stringValue(value.accessibilityNotes, ""),
  };
}

function defaultAnimation() {
  return { type: "none" as const, durationMs: 0, curve: "linear", delayMs: 0 };
}

function defaultSemanticRole(type: string) {
  if (type === "button") return "button";
  if (type === "input") return "input";
  if (type === "bottomNav") return "navigation";
  if (type === "text") return "text";
  return "group";
}

function triggerValue(value: unknown) {
  return ["tap", "longTap", "swipe", "drag", "pull", "scroll"].includes(String(value)) ? value as any : "tap";
}

function sourceValue(value: unknown) {
  return ["ai", "manual", "legacy_migration", "system"].includes(String(value)) ? value as any : "ai";
}

function createdByValue(value: unknown) {
  return ["ai", "user", "system"].includes(String(value)) ? value as any : "ai";
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
