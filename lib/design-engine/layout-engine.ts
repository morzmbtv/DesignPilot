import type {
  CompositionAnchor,
  IdmComposition,
  IdmElement,
  IdmLayout,
  InternalDesignModel,
  LayoutEngineDebugEntry,
} from "@/lib/idm/types";

const SIZE_RATIOS = { tiny: 0.1, small: 0.22, medium: 0.4, large: 0.58, hero: 0.66, full: 1 } as const;
const PRIORITY_Z = { background: 0, decorative: 10, content: 30, critical: 50 } as const;

export type LayoutEngineResult = {
  idm: InternalDesignModel;
  entries: LayoutEngineDebugEntry[];
  warnings: string[];
};

export function resolveCompositionLayout(idm: InternalDesignModel): LayoutEngineResult {
  const viewport = {
    ...idm.metadata.viewport,
    bottomNavArea: idm.hierarchy.elements.some((element) => element.type === "bottomNav" && element.layout.visible !== false)
      ? idm.metadata.viewport.bottomNavArea
      : 0,
  };
  const byId = new Map(idm.hierarchy.elements.map((element) => [element.id, element]));
  const resolved = new Map<string, IdmLayout>();
  const entries: LayoutEngineDebugEntry[] = [];
  const warnings: string[] = [];
  const rootId = idm.hierarchy.rootId;
  const ordered = idm.hierarchy.elements
    .filter((element) => element.id !== rootId)
    .slice()
    .sort((a, b) => compositionOrder(a) - compositionOrder(b));

  for (let index = 0; index < ordered.length; index += 1) {
    const element = ordered[index];
    if (!element.composition || element.layout.manualOverride) {
      resolved.set(element.id, element.layout);
      entries.push({
        elementId: element.id,
        composition: element.composition ?? null,
        resolvedLayout: element.layout,
        normalizationChanges: [],
        warnings: element.layout.manualOverride ? ["Использован manual layout override."] : [],
      });
      continue;
    }
    const layout = resolveElement(element, viewport, index);
    resolved.set(element.id, layout);
    entries.push({ elementId: element.id, composition: element.composition, resolvedLayout: layout, normalizationChanges: [], warnings: [] });
  }

  for (const element of ordered) {
    const relation = parseRelation(element.composition?.relationTo);
    if (!relation || element.layout.manualOverride) continue;
    const target = resolved.get(relation.targetId);
    const current = resolved.get(element.id);
    if (!target || !current) {
      const warning = `${element.id}: relationTo ссылается на отсутствующий элемент ${relation.targetId}.`;
      warnings.push(warning);
      entries.find((entry) => entry.elementId === element.id)?.warnings.push(warning);
      continue;
    }
    resolved.set(element.id, applyRelation(current, target, relation.kind, idm.metadata.viewport.pagePadding));
  }

  const elements = idm.hierarchy.elements.map((element) => {
    if (element.id === rootId) {
      return {
        ...element,
        layout: { ...element.layout, x: 0, y: 0, width: viewport.width, height: viewport.height, source: "engine" as const },
      };
    }
    return { ...element, layout: resolved.get(element.id) ?? element.layout };
  });
  for (const entry of entries) {
    entry.resolvedLayout = resolved.get(entry.elementId) ?? entry.resolvedLayout;
  }
  return { idm: { ...idm, hierarchy: { ...idm.hierarchy, elements } }, entries, warnings };
}

function resolveElement(element: IdmElement, viewport: InternalDesignModel["metadata"]["viewport"], index: number): IdmLayout {
  const composition = element.composition!;
  if (composition.anchor === "fullScreen") {
    return { ...element.layout, x: 0, y: 0, width: viewport.width, height: viewport.height, zIndex: priorityZ(composition, index), source: "engine", manualOverride: false };
  }
  const paddingX = composition.horizontalPadding ?? (composition.priority === "decorative" ? 0 : viewport.pagePadding);
  const paddingY = composition.verticalPadding ?? (composition.priority === "decorative" ? 0 : viewport.pagePadding);
  const availableWidth = Math.max(4, viewport.width - paddingX * 2);
  const availableHeight = Math.max(4, viewport.height - viewport.safeAreaTop - paddingY * 2);
  const ratio = composition.size ? SIZE_RATIOS[composition.size] : undefined;
  const width = dimension({
    explicit: composition.width,
    ratio: composition.widthRatio ?? ratio,
    available: availableWidth,
    fallback: element.layout.width,
    min: composition.minWidth,
    max: composition.maxWidth,
  });
  const heightFromAspect = element.layout.width > 0 ? width * element.layout.height / element.layout.width : element.layout.height;
  const height = dimension({
    explicit: composition.height,
    ratio: composition.heightRatio,
    available: availableHeight,
    fallback: composition.heightRatio ? element.layout.height : heightFromAspect,
    min: composition.minHeight,
    max: composition.maxHeight,
  });
  const anchor = composition.anchor ?? "topLeft";
  const position = anchorPosition(anchor, width, height, viewport, composition, paddingX, paddingY);
  return {
    ...element.layout,
    x: Math.round(position.x),
    y: Math.round(position.y),
    width: Math.round(width),
    height: Math.round(height),
    align: composition.align ?? element.layout.align,
    zIndex: priorityZ(composition, index),
    source: "engine",
    manualOverride: false,
  };
}

function anchorPosition(
  anchor: CompositionAnchor,
  width: number,
  height: number,
  viewport: InternalDesignModel["metadata"]["viewport"],
  composition: IdmComposition,
  paddingX: number,
  paddingY: number,
) {
  const left = composition.leftOffset ?? paddingX;
  const right = composition.rightOffset ?? paddingX;
  const top = composition.topOffset ?? viewport.safeAreaTop + paddingY;
  const bottom = composition.bottomOffset ?? paddingY + (composition.avoid?.includes("bottomControls") ? viewport.bottomNavArea ?? 0 : 0);
  const centerX = (viewport.width - width) / 2;
  const centerY = (viewport.height - height) / 2;
  if (anchor === "topLeft") return { x: left, y: top };
  if (anchor === "topCenter") return { x: centerX, y: top };
  if (anchor === "topRight") return { x: viewport.width - right - width, y: top };
  if (anchor === "centerLeft") return { x: left, y: centerY };
  if (anchor === "center") return { x: centerX, y: centerY };
  if (anchor === "centerRight") return { x: viewport.width - right - width, y: centerY };
  if (anchor === "bottomLeft") return { x: left, y: viewport.height - bottom - height };
  if (anchor === "bottomCenter") return { x: centerX, y: viewport.height - bottom - height };
  return { x: viewport.width - right - width, y: viewport.height - bottom - height };
}

function dimension(input: {
  explicit?: number | "full";
  ratio?: number;
  available: number;
  fallback: number;
  min?: number;
  max?: number;
}) {
  let value = input.explicit === "full"
    ? input.available
    : typeof input.explicit === "number"
      ? input.explicit
      : typeof input.ratio === "number"
        ? input.available * clamp(input.ratio, 0.02, 1.5)
        : input.fallback;
  value = Math.max(input.min ?? 4, value);
  value = Math.min(input.max ?? Number.POSITIVE_INFINITY, value);
  return Math.max(4, value);
}

function priorityZ(composition: IdmComposition, index: number) {
  return PRIORITY_Z[composition.priority ?? "content"] + index;
}

function compositionOrder(element: IdmElement) {
  const priority = element.composition?.priority ?? rolePriority(element);
  return PRIORITY_Z[priority];
}

function rolePriority(element: IdmElement): keyof typeof PRIORITY_Z {
  if (element.type === "background") return "background";
  if (element.type === "decoration") return "decorative";
  if (element.type === "text" || element.type === "button" || element.type === "progress" || element.semanticRole === "logo") return "critical";
  return "content";
}

function parseRelation(value?: string) {
  if (!value) return null;
  const [kind, targetId] = value.split(":", 2);
  if (!targetId || !["above", "below", "leftOf", "rightOf", "overlap"].includes(kind)) return null;
  return { kind: kind as "above" | "below" | "leftOf" | "rightOf" | "overlap", targetId };
}

function applyRelation(layout: IdmLayout, target: IdmLayout, kind: "above" | "below" | "leftOf" | "rightOf" | "overlap", gap: number): IdmLayout {
  if (kind === "above") return { ...layout, y: target.y - gap - layout.height };
  if (kind === "below") return { ...layout, y: target.y + target.height + gap };
  if (kind === "leftOf") return { ...layout, x: target.x - gap - layout.width };
  if (kind === "rightOf") return { ...layout, x: target.x + target.width + gap };
  return { ...layout, x: target.x + (target.width - layout.width) / 2, y: target.y + (target.height - layout.height) / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
