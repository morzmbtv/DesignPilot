import type { InternalDesignModel } from "@/lib/idm/types";
import { readEditorProperties } from "@/lib/idm/editor-properties";

export function generateDesignSpecFromIdm(idm: InternalDesignModel) {
  const viewport = idm.metadata.viewport;
  const elements = idm.hierarchy.elements.filter((element) => element.id !== idm.hierarchy.rootId);
  const lines = [
    `# ${idm.metadata.screenName}`,
    "",
    `Проект: ${idm.metadata.project}`,
    `Платформа: ${idm.metadata.platform}`,
    `Viewport: ${viewport.width}×${viewport.height}px, safe area top ${viewport.safeAreaTop}px, page padding ${viewport.pagePadding}px.`,
    "",
    "## Иерархия и расположение",
    ...elements.map((element, index) => {
      const editor = readEditorProperties(element);
      return [
      `${index + 1}. ${element.name} (${element.type}, id=${element.id})`,
      `   - parent: ${element.parent || "none"}`,
      `   - semanticRole: ${element.semanticRole}`,
      `   - content: ${element.content.text || element.content.alt || element.name}`,
      element.content.assetRef ? `   - asset: assetRef=${element.content.assetRef}, role=${element.content.assetRole || "asset"}` : "   - asset: нет",
      `   - layout: x=${element.layout.x}, y=${element.layout.y}, width=${element.layout.width}, height=${element.layout.height}, rotation=${editor.rotation}, align=${element.layout.align || "left"}, zIndex=${element.layout.zIndex ?? 1}, visible=${element.layout.visible !== false}, locked=${Boolean(element.layout.locked)}`,
      `   - style: background=${element.style.background || "transparent"}, typography=${element.style.typography || "default"}, font=${editor.fontFamily || "default"} ${editor.fontSize || "default"}px/${editor.fontWeight || "default"}, color=${element.style.color || "default"}, radius=${element.layout.radius ?? 0}, opacity=${element.style.opacity ?? 1}`,
      `   - constraints: ${element.constraints.length ? element.constraints.join("; ") : "нет"}`,
      `   - behavior: ${element.behavior.length ? element.behavior.join("; ") : "нет"}`,
      element.componentRef ? `   - componentRef: ${element.componentRef.name} (${element.componentRef.componentId})` : "   - componentRef: нет",
      ].join("\n");
    }),
    "",
    "## Motion",
    generateMotionSummary(idm),
    "",
    "## Accessibility",
    `Минимальная интерактивная зона: ${idm.accessibility.minimumTapTarget}px.`,
    ...(idm.accessibility.notes.length ? idm.accessibility.notes.map((note) => `- ${note}`) : ["- Проверить читаемость и контраст."]),
    "",
    "## История",
    idm.exportMetadata.changeSummary,
  ];
  return lines.join("\n");
}

function generateMotionSummary(idm: InternalDesignModel) {
  const animated = idm.hierarchy.elements.filter((element) => element.animation.type !== "none");
  if (!animated.length) return "Экран использует статичную композицию без обязательных анимаций.";
  return animated.map((element) => `- ${element.id}: ${element.animation.type}, ${element.animation.durationMs}ms, ${element.animation.curve}, delay ${element.animation.delayMs}ms.`).join("\n");
}
