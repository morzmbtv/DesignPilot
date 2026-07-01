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
  if (element.type === "background") return "background";
  if (element.type === "decoration") return "decoration";
  if (element.type === "character") return "character";
  if (element.type === "illustration") return "illustration";
  if (element.type === "icon") return "icon";
  if (element.type === "image") return "photo";

  const value = `${element.content.assetRole || ""} ${element.semanticRole} ${element.name} ${element.id}`.toLowerCase();
  if (/background|фон/.test(value)) return "background";
  if (/character|персонаж|hero/.test(value)) return "character";
  if (/decoration|декор/.test(value)) return "decoration";
  if (/icon|икон/.test(value)) return "icon";
  if (/photo|фото/.test(value)) return "photo";
  return "illustration";
}

function buildElementImagePrompt(idm: InternalDesignModel, element: IdmElement, type: ProjectAssetType) {
  const description = element.content.text || element.content.alt || element.name;
  const specializedInstruction = assetInstruction(type, `${element.id} ${element.name} ${description}`);
  return [
    `Generate the visual asset for screen "${idm.metadata.screenName}".`,
    `Asset type: ${type}.`,
    `Element id: ${element.id}.`,
    `Element name: ${element.name}.`,
    `Content: ${description}.`,
    `Semantic role: ${element.semanticRole}.`,
    `Target bounds: ${element.layout.width}x${element.layout.height}px.`,
    `Style: background=${element.style.background || "transparent"}, color=${element.style.color || "project palette"}, opacity=${element.style.opacity ?? 1}, typography=${element.style.typography || "not applicable"}.`,
    specializedInstruction,
    element.constraints.length ? `Constraints: ${element.constraints.join("; ")}.` : "",
    "Create only this standalone visual element, not the whole product screen.",
  ].filter(Boolean).join("\n");
}

function assetInstruction(type: ProjectAssetType, value: string) {
  if (type === "character") {
    return "Create a standalone character with clean edges, no text, suitable as a product UI asset, with transparent or simple background when possible.";
  }
  if (/\bschool\b|школ/i.test(value)) {
    return "Create a standalone school building illustration with clean edges and no text. Do not render a complete app screen.";
  }
  if (type === "decoration" || type === "icon" || type === "illustration") {
    return "Use a transparent or simple background, clean edges, and no text.";
  }
  if (type === "background") {
    return "Create only the full-bleed background artwork. Do not include logos, UI controls, labels, or readable text.";
  }
  return "Do not include readable text.";
}

function inferAspectRatio(element: IdmElement) {
  const ratio = element.layout.width / Math.max(1, element.layout.height);
  if (ratio > 1.5) return "16:9";
  if (ratio < 0.7) return "9:16";
  if (ratio < 0.9) return "3:4";
  if (ratio > 1.1) return "4:3";
  return "1:1";
}
