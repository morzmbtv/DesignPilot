import { layoutElementTypes, type LayoutElement, type LayoutJson } from "@/lib/layout";
import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";
import { readEditorProperties } from "@/lib/idm/editor-properties";

export function generateLayoutFromIdm(idm: InternalDesignModel): LayoutJson {
  const elements = idm.hierarchy.elements
    .filter((element) => element.id !== idm.hierarchy.rootId)
    .filter((element) => element.layout.visible !== false)
    .map(toLayoutElement);
  return { viewport: { width: 390, height: 844 }, elements };
}

function toLayoutElement(element: IdmElement): LayoutElement {
  const type = layoutElementTypes.includes(element.type) ? element.type : "section";
  const editor = readEditorProperties(element);
  return {
    id: element.id,
    type,
    label: element.content.text || element.name || element.id,
    x: finite(element.layout.x, 20),
    y: finite(element.layout.y, 120),
    width: Math.max(4, finite(element.layout.width, 350)),
    height: Math.max(4, finite(element.layout.height, 56)),
    align: element.layout.align || "left",
    style: element.style.typography || "default",
    radius: finite(element.layout.radius, type === "button" ? 14 : 0),
    background: element.style.background || "transparent",
    opacity: finite(element.style.opacity, 1),
    zIndex: finite(element.layout.zIndex, 1),
    locked: Boolean(element.layout.locked),
    rotation: editor.rotation,
    color: element.style.color,
    fontFamily: editor.fontFamily,
    fontSize: editor.fontSize,
    fontWeight: editor.fontWeight,
    visible: element.layout.visible !== false,
    componentRef: element.componentRef?.componentId,
    assetRef: element.content.assetRef,
    assetRole: element.content.assetRole,
  };
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
