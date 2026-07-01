import type { InternalDesignModel } from "@/lib/idm/types";
import { readEditorProperties } from "@/lib/idm/editor-properties";

export function generateCssLayout(idm: InternalDesignModel) {
  const lines = [
    ".screen {",
    "  position: relative;",
    `  width: ${idm.metadata.viewport.width}px;`,
    `  height: ${idm.metadata.viewport.height}px;`,
    "  overflow: hidden;",
    "}",
    "",
  ];

  for (const element of idm.hierarchy.elements) {
    if (element.id === idm.hierarchy.rootId || element.layout.visible === false) continue;
    const editor = readEditorProperties(element);
    lines.push(
      `#${escapeIdentifier(element.id)} {`,
      "  position: absolute;",
      `  left: ${element.layout.x}px;`,
      `  top: ${element.layout.y}px;`,
      `  width: ${element.layout.width}px;`,
      `  height: ${element.layout.height}px;`,
      `  transform: rotate(${editor.rotation}deg);`,
      `  border-radius: ${element.layout.radius ?? 0}px;`,
      `  opacity: ${element.style.opacity ?? 1};`,
      `  z-index: ${element.layout.zIndex ?? 1};`,
      `  background: ${element.style.background || "transparent"};`,
      ...(element.content.assetRef ? [`  background-image: url("asset://${element.content.assetRef}");`, "  background-size: contain;", "  background-repeat: no-repeat;"] : []),
      `  color: ${element.style.color || "inherit"};`,
      ...(editor.fontFamily ? [`  font-family: ${editor.fontFamily};`] : []),
      ...(editor.fontSize ? [`  font-size: ${editor.fontSize}px;`] : []),
      ...(editor.fontWeight ? [`  font-weight: ${editor.fontWeight};`] : []),
      "}",
      "",
    );
  }

  return lines.join("\n").trim();
}

function escapeIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
