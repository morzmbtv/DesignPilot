import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";

type PrimaryLogo = { id: string; name: string; width?: number | null; height?: number | null };

export function applyPrimaryLogoPolicy(idm: InternalDesignModel, primaryLogo: PrimaryLogo | null, ensureElement: boolean) {
  if (!primaryLogo) return idm;
  let found = false;
  const elements = idm.hierarchy.elements.map((element) => {
    if (!isLogoElement(element)) return element;
    found = true;
    return {
      ...element,
      content: {
        ...element.content,
        assetRef: primaryLogo.id,
        assetRole: "primaryLogo",
        alt: primaryLogo.name,
      },
      constraints: Array.from(new Set([...element.constraints, "asset:primary-logo", "asset:do-not-redraw"])),
      semanticRole: "logo",
    };
  });
  if (found || !ensureElement) return { ...idm, hierarchy: { ...idm.hierarchy, elements } };

  const rootId = idm.hierarchy.rootId;
  const width = Math.min(200, primaryLogo.width || 200);
  const height = Math.min(140, Math.max(48, Math.round(width * (primaryLogo.height || 100) / (primaryLogo.width || 200))));
  const id = uniqueId(elements, "primary_logo");
  const logo: IdmElement = {
    id,
    type: "image",
    name: primaryLogo.name,
    parent: rootId,
    children: [],
    layout: { x: Math.round((390 - width) / 2), y: 96, width, height, zIndex: maxZ(elements) + 1, visible: true, locked: false },
    style: { background: "transparent", opacity: 1 },
    animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
    constraints: ["asset:primary-logo", "asset:do-not-redraw", "editor:rotation=0"],
    behavior: [],
    semanticRole: "logo",
    content: { text: primaryLogo.name, alt: primaryLogo.name, assetRef: primaryLogo.id, assetRole: "primaryLogo" },
    componentRef: null,
    state: {},
  };
  return {
    ...idm,
    hierarchy: {
      ...idm.hierarchy,
      elements: elements.map((element) => element.id === rootId ? { ...element, children: [...element.children, id] } : element).concat(logo),
    },
  };
}

export function sanitizeAssetReferences(idm: InternalDesignModel, validAssetIds: Iterable<string>) {
  const valid = new Set(validAssetIds);
  return {
    ...idm,
    hierarchy: {
      ...idm.hierarchy,
      elements: idm.hierarchy.elements.map((element) => {
        if (!element.content.assetRef || valid.has(element.content.assetRef)) return element;
        const { assetRef: _assetRef, assetRole: _assetRole, ...content } = element.content;
        return { ...element, content };
      }),
    },
  };
}

function isLogoElement(element: IdmElement) {
  return element.content.assetRole === "primaryLogo" ||
    element.semanticRole === "logo" ||
    /(^|[_\s-])(logo|логотип)([_\s-]|$)/i.test(`${element.id} ${element.name} ${element.content.text || ""}`);
}
function maxZ(elements: IdmElement[]) {
  return Math.max(0, ...elements.map((element) => element.layout.zIndex ?? 0));
}
function uniqueId(elements: IdmElement[], prefix: string) {
  const ids = new Set(elements.map((element) => element.id));
  if (!ids.has(prefix)) return prefix;
  let index = 2;
  while (ids.has(`${prefix}_${index}`)) index++;
  return `${prefix}_${index}`;
}
