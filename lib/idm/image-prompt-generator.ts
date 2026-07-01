import type { LayoutJson } from "@/lib/layout";
import type { InternalDesignModel } from "@/lib/idm/types";

export function generateImagePromptFromIdm(idm: InternalDesignModel, layoutJson: LayoutJson) {
  const lines = [
    `Create one high-fidelity frontal mobile app screen for "${idm.metadata.project}", screen "${idm.metadata.screenName}".`,
    `Viewport must be exactly ${idm.metadata.viewport.width}x${idm.metadata.viewport.height}px. Safe area top ${idm.metadata.viewport.safeAreaTop}px. Page padding ${idm.metadata.viewport.pagePadding}px.`,
    "Use the project's existing visual language and component library references. Do not invent a new style.",
    "",
    "VISIBLE ELEMENTS:",
    ...layoutJson.elements.map((element) => `- ${element.type} [${element.id}] "${element.label}" at x=${element.x}, y=${element.y}, width=${element.width}, height=${element.height}, align=${element.align || "left"}, radius=${element.radius ?? 0}, background=${element.background || "transparent"}, zIndex=${element.zIndex ?? 1}.`),
    "",
    "STRICT LAYOUT:",
    ...layoutJson.elements.map((element) => `- element [${element.id}] "${element.label}" must be exactly at x=${element.x}, y=${element.y}, width=${element.width}, height=${element.height}.`),
    "- Preserve all other layout, colors, typography, spacing, and elements unchanged.",
    "- Do not reinterpret the screen.",
    "- Do not redesign the screen.",
    "- Do not use placeholder grey rectangles unless the component is explicitly an image/illustration placeholder.",
    "",
    "ACCESSIBILITY:",
    `- Keep text readable and touch targets at least ${idm.accessibility.minimumTapTarget}px when interactive.`,
  ];
  return lines.join("\n");
}
