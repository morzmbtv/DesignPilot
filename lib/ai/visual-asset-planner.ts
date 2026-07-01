import type { ProjectAssetType } from "@/lib/assets";
import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";

const VISUAL_ROLES = new Set(["image", "illustration", "character", "decoration", "background", "icon", "photo"]);

export type VisualAssetPlan = {
  elementId: string;
  name: string;
  type: ProjectAssetType;
  prompt: string;
  background: "transparent" | "opaque";
  aspectRatio: string;
};

export function planMissingVisualAssets(idm: InternalDesignModel): VisualAssetPlan[] {
  return idm.hierarchy.elements
    .filter(isVisualCandidate)
    .filter((element) => !isLogoElement(element))
    .map((element) => {
      const type = inferAssetType(element);
      return {
        elementId: element.id,
        name: element.name || element.content.text || element.id,
        type,
        prompt: buildElementImagePrompt(idm, element, type),
        background: type === "background" ? "opaque" : "transparent",
        aspectRatio: inferAspectRatio(element),
      };
    });
}

export function attachGeneratedAsset(
  idm: InternalDesignModel,
  elementId: string,
  asset: { id: string; type: ProjectAssetType },
) {
  return {
    ...idm,
    hierarchy: {
      ...idm.hierarchy,
      elements: idm.hierarchy.elements.map((element) => element.id === elementId ? {
        ...element,
        content: {
          ...element.content,
          assetRef: asset.id,
          assetRole: asset.type,
          alt: element.content.alt || element.name,
        },
        constraints: Array.from(new Set([...element.constraints, "asset:generated-by-openrouter", "asset:preserve-reference"])),
      } : element),
    },
  };
}

function isVisualCandidate(element: IdmElement) {
  if (element.content.assetRef || element.id === "screen_root") return false;
  const role = `${element.type} ${element.content.assetRole || ""} ${element.semanticRole}`.toLowerCase();
  return element.type === "image" ||
    element.type === "illustration" ||
    element.type === "icon" ||
    Array.from(VISUAL_ROLES).some((item) => role.includes(item));
}

function isLogoElement(element: IdmElement) {
  return element.content.assetRole === "primaryLogo" ||
    element.semanticRole === "logo" ||
    /(^|[_\s-])(logo|логотип)([_\s-]|$)/i.test(`${element.id} ${element.name} ${element.content.text || ""}`);
}

function inferAssetType(element: IdmElement): ProjectAssetType {
  const value = `${element.content.assetRole || ""} ${element.semanticRole} ${element.name} ${element.id}`.toLowerCase();
  if (/background|фон/.test(value)) return "background";
  if (/character|персонаж|hero/.test(value)) return "character";
  if (/decoration|декор/.test(value)) return "decoration";
  if (/icon|икон/.test(value) || element.type === "icon") return "icon";
  if (/photo|фото/.test(value) || element.type === "image") return "photo";
  return "illustration";
}

function buildElementImagePrompt(idm: InternalDesignModel, element: IdmElement, type: ProjectAssetType) {
  return [
    `Generate the visual asset for screen "${idm.metadata.screenName}".`,
    `Asset type: ${type}.`,
    `Element id: ${element.id}.`,
    `Element name: ${element.name}.`,
    `Content: ${element.content.text || element.content.alt || element.name}.`,
    `Semantic role: ${element.semanticRole}.`,
    `Target bounds: ${element.layout.width}x${element.layout.height}px.`,
    `Style: background=${element.style.background || "transparent"}, color=${element.style.color || "project palette"}, opacity=${element.style.opacity ?? 1}, typography=${element.style.typography || "not applicable"}.`,
    element.constraints.length ? `Constraints: ${element.constraints.join("; ")}.` : "",
    "Create only this standalone visual element, not the whole mobile screen.",
  ].filter(Boolean).join("\n");
}

function inferAspectRatio(element: IdmElement) {
  const ratio = element.layout.width / Math.max(1, element.layout.height);
  if (ratio > 1.5) return "16:9";
  if (ratio < 0.7) return "9:16";
  if (ratio < 0.9) return "3:4";
  if (ratio > 1.1) return "4:3";
  return "1:1";
}
