import type { IdmElement, IdmLayout, InternalDesignModel, LayoutEngineDebugEntry } from "@/lib/idm/types";

export type ViewportNormalizationResult = {
  idm: InternalDesignModel;
  entries: LayoutEngineDebugEntry[];
  warnings: string[];
};

export function normalizeLayoutToViewport(
  idm: InternalDesignModel,
  engineEntries: LayoutEngineDebugEntry[] = [],
): ViewportNormalizationResult {
  const viewport = idm.metadata.viewport;
  const hasBottomControls = idm.hierarchy.elements.some((element) => element.type === "bottomNav" && element.layout.visible !== false);
  const entryById = new Map(engineEntries.map((entry) => [entry.elementId, entry]));
  const warnings: string[] = [];
  let elements = idm.hierarchy.elements.map((element) => {
    if (element.id === idm.hierarchy.rootId) return element;
    const result = normalizeElement(element, viewport, hasBottomControls);
    const entry = entryById.get(element.id);
    if (entry) {
      entry.normalizationChanges.push(...result.changes);
      entry.warnings.push(...result.debugNotes);
      entry.resolvedLayout = result.layout;
    }
    warnings.push(...result.warnings);
    return { ...element, layout: result.layout };
  });

  const heuristics = applyAutoLayoutHeuristics(elements, idm.hierarchy.rootId, viewport, hasBottomControls);
  elements = heuristics.elements;
  for (const change of heuristics.changes) {
    const entry = entryById.get(change.elementId);
    if (entry) {
      entry.normalizationChanges.push(change.description);
      const element = elements.find((item) => item.id === change.elementId);
      if (element) entry.resolvedLayout = element.layout;
    }
  }
  warnings.push(...heuristics.warnings);

  return {
    idm: { ...idm, hierarchy: { ...idm.hierarchy, elements } },
    entries: engineEntries,
    warnings: unique(warnings),
  };
}

function normalizeElement(
  element: IdmElement,
  viewport: InternalDesignModel["metadata"]["viewport"],
  hasBottomControls: boolean,
) {
  if (isBackground(element)) {
    return unchanged(element, "Background: выход за viewport разрешён.");
  }
  if (isDecoration(element)) {
    return unchanged(element, "Decoration: частичный выход за viewport разрешён.");
  }

  const original = roundLayout(element.layout);
  let layout = { ...original };
  if (isText(element)) layout = fitTextContainer(layout, viewport);
  else if (isVisual(element) || isLogo(element)) layout = fitVisual(layout, viewport, isLogo(element));
  else layout = fitBox(layout, viewport, element.type === "progress", hasBottomControls);

  const changes = diffLayout(original, layout);
  const warnings = isInside(layout, viewport)
    ? []
    : [`${element.id}: элемент невозможно полностью нормализовать; оставлен рабочий layout.`];
  return {
    layout,
    changes,
    warnings,
    debugNotes: changes.length ? [`Viewport Normalizer: ${changes.join(", ")}.`] : [],
  };
}

function fitVisual(
  source: IdmLayout,
  viewport: InternalDesignModel["metadata"]["viewport"],
  logo: boolean,
) {
  const padding = logo ? viewport.pagePadding : 0;
  const minX = padding;
  const minY = logo ? viewport.safeAreaTop : 0;
  const maxRight = viewport.width - padding;
  const maxBottom = viewport.height;
  let layout = { ...source };

  // Сначала перемещаем элемент, сохраняя размер.
  if (layout.x + layout.width > maxRight) layout.x -= layout.x + layout.width - maxRight;
  if (layout.x < minX) layout.x = minX;
  if (layout.y + layout.height > maxBottom) layout.y -= layout.y + layout.height - maxBottom;
  if (layout.y < minY) layout.y = minY;

  // Только если перемещения недостаточно — уменьшаем с сохранением пропорций.
  const availableWidth = Math.max(4, maxRight - minX);
  const availableHeight = Math.max(4, maxBottom - minY);
  if (layout.width > availableWidth || layout.height > availableHeight) {
    const scale = Math.min(1, availableWidth / layout.width, availableHeight / layout.height);
    layout.width = Math.max(4, layout.width * scale);
    layout.height = Math.max(4, layout.height * scale);
    layout.x = clamp(layout.x, minX, maxRight - layout.width);
    layout.y = clamp(layout.y, minY, maxBottom - layout.height);
  }
  return roundLayout(layout);
}

function fitTextContainer(source: IdmLayout, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const padding = viewport.pagePadding;
  const availableWidth = Math.max(4, viewport.width - padding * 2);
  const availableHeight = Math.max(4, viewport.height - viewport.safeAreaTop);
  const layout = {
    ...source,
    width: Math.min(source.width, availableWidth),
    height: Math.min(source.height, availableHeight),
  };
  layout.x = clamp(layout.x, padding, viewport.width - padding - layout.width);
  layout.y = clamp(layout.y, viewport.safeAreaTop, viewport.height - layout.height);
  return roundLayout(layout);
}

function fitBox(
  source: IdmLayout,
  viewport: InternalDesignModel["metadata"]["viewport"],
  progress: boolean,
  hasBottomControls: boolean,
) {
  const padding = viewport.pagePadding;
  const bottomInset = progress
    ? Math.max(16, hasBottomControls ? (viewport.bottomNavArea ?? 0) + 12 : 16)
    : 0;
  const maxRight = viewport.width - padding;
  const maxBottom = viewport.height - bottomInset;
  const layout = {
    ...source,
    width: Math.min(source.width, Math.max(4, viewport.width - padding * 2)),
    height: Math.min(source.height, Math.max(4, maxBottom - viewport.safeAreaTop)),
  };
  layout.x = clamp(layout.x, padding, maxRight - layout.width);
  layout.y = clamp(layout.y, viewport.safeAreaTop, maxBottom - layout.height);
  return roundLayout(layout);
}

function applyAutoLayoutHeuristics(
  elements: IdmElement[],
  rootId: string,
  viewport: InternalDesignModel["metadata"]["viewport"],
  hasBottomControls: boolean,
) {
  const changes: Array<{ elementId: string; description: string }> = [];
  const warnings: string[] = [];
  const byId = new Map(elements.map((element) => [element.id, element]));
  const logo = elements.find(isLogo);
  const loading = elements.find((element) => element.type === "text" && /loading|загруз/i.test(`${element.id} ${element.name} ${element.content.text || ""}`));
  const progress = elements.find((element) => element.type === "progress");
  const criticalBottom = Math.min(
    loading?.layout.y ?? viewport.height,
    progress?.layout.y ?? viewport.height,
  );

  if (logo) {
    for (const hero of elements.filter((element) => isHero(element) && element.id !== rootId)) {
      if (!overlaps(hero.layout, logo.layout)) continue;
      const maxY = viewport.height - hero.layout.height;
      const desiredY = logo.layout.y + logo.layout.height + 16;
      if (desiredY <= maxY) {
        updateLayout(byId, hero.id, { y: desiredY });
        changes.push({ elementId: hero.id, description: `Auto Layout: hero опущен ниже logo, y ${hero.layout.y}→${Math.round(desiredY)}` });
      } else {
        warnings.push(`${hero.id}: недостаточно места, чтобы полностью развести hero и logo.`);
      }
    }
  }

  if (criticalBottom < viewport.height) {
    for (const visual of elements.filter((element) => isVisual(element) && !isLogo(element))) {
      const current = byId.get(visual.id)!;
      if (current.layout.y + current.layout.height <= criticalBottom - 16) continue;
      const availableHeight = criticalBottom - 16 - current.layout.y;
      if (availableHeight < 4) continue;
      const scale = Math.min(1, availableHeight / current.layout.height);
      if (scale >= 0.98) continue;
      const next = {
        width: Math.max(4, Math.round(current.layout.width * scale)),
        height: Math.max(4, Math.round(current.layout.height * scale)),
      };
      updateLayout(byId, current.id, next);
      changes.push({ elementId: current.id, description: `Auto Layout: visual уменьшен перед loading controls, ${current.layout.width}×${current.layout.height}→${next.width}×${next.height}` });
    }
  }

  if (progress) {
    const current = byId.get(progress.id)!;
    const bottomInset = hasBottomControls ? (viewport.bottomNavArea ?? 0) + 12 : 16;
    const maxY = viewport.height - bottomInset - current.layout.height;
    if (current.layout.y > maxY) {
      updateLayout(byId, current.id, { y: maxY });
      changes.push({ elementId: current.id, description: `Auto Layout: progress поднят на безопасный отступ, y ${current.layout.y}→${Math.round(maxY)}` });
    }
  }

  return { elements: elements.map((element) => byId.get(element.id) ?? element), changes, warnings };
}

function updateLayout(byId: Map<string, IdmElement>, id: string, patch: Partial<IdmLayout>) {
  const element = byId.get(id);
  if (element) byId.set(id, { ...element, layout: roundLayout({ ...element.layout, ...patch }) });
}

function unchanged(element: IdmElement, note: string) {
  return { layout: element.layout, changes: [], warnings: [], debugNotes: [note] };
}
function isBackground(element: IdmElement) {
  return element.type === "background" || element.semanticRole === "background";
}
function isDecoration(element: IdmElement) {
  return element.type === "decoration" || /decoration|shadow|glow|blur|декор|тень|свечение/i.test(`${element.semanticRole} ${element.content.assetRole || ""} ${element.name}`);
}
function isText(element: IdmElement) {
  return element.type === "text";
}
function isLogo(element: IdmElement) {
  return element.semanticRole === "logo" || element.content.assetRole === "primaryLogo" || /(^|[_\s-])(logo|логотип)([_\s-]|$)/i.test(`${element.id} ${element.name}`);
}
function isHero(element: IdmElement) {
  return /hero|character|student|персонаж|ученик/i.test(`${element.id} ${element.name} ${element.semanticRole} ${element.content.assetRole || ""}`);
}
function isVisual(element: IdmElement) {
  return ["image", "illustration", "character", "icon"].includes(element.type) ||
    /product|hero|image|illustration|character|product|visual/i.test(`${element.semanticRole} ${element.content.assetRole || ""}`);
}
function isInside(layout: IdmLayout, viewport: { width: number; height: number }) {
  return layout.x >= 0 && layout.y >= 0 && layout.x + layout.width <= viewport.width && layout.y + layout.height <= viewport.height;
}
function overlaps(a: IdmLayout, b: IdmLayout) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function diffLayout(previous: IdmLayout, next: IdmLayout) {
  return (["x", "y", "width", "height"] as const).flatMap((key) => {
    const before = Math.round(previous[key]);
    const after = Math.round(next[key]);
    return before === after ? [] : [`${key} ${before}→${after}`];
  });
}
function roundLayout(layout: IdmLayout): IdmLayout {
  return { ...layout, x: Math.round(layout.x), y: Math.round(layout.y), width: Math.round(layout.width), height: Math.round(layout.height) };
}
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
function unique(values: string[]) {
  return Array.from(new Set(values));
}
