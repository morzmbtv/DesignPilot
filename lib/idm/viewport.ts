import type { InternalDesignModel } from "@/lib/idm/types";

export function applyViewportToIdm(
  idm: InternalDesignModel,
  viewport: { width: number; height: number; safeAreaTop: number; pagePadding: number },
  platform: string,
) {
  const oldWidth = Math.max(1, idm.metadata.viewport.width);
  const oldHeight = Math.max(1, idm.metadata.viewport.height);
  const scaleX = viewport.width / oldWidth;
  const scaleY = viewport.height / oldHeight;
  const rootId = idm.hierarchy.rootId;
  return {
    ...idm,
    metadata: {
      ...idm.metadata,
      platform,
      viewport: {
        ...idm.metadata.viewport,
        width: viewport.width,
        height: viewport.height,
        safeAreaTop: viewport.safeAreaTop,
        pagePadding: viewport.pagePadding,
      },
    },
    hierarchy: {
      ...idm.hierarchy,
      elements: idm.hierarchy.elements.map((element) => element.id === rootId ? {
        ...element,
        layout: { ...element.layout, x: 0, y: 0, width: viewport.width, height: viewport.height },
        constraints: [`viewport:${viewport.width}x${viewport.height}`],
      } : {
        ...element,
        layout: {
          ...element.layout,
          x: Math.round(element.layout.x * scaleX),
          y: Math.round(element.layout.y * scaleY),
          width: Math.max(4, Math.round(element.layout.width * scaleX)),
          height: Math.max(4, Math.round(element.layout.height * scaleY)),
        },
      }),
    },
  } satisfies InternalDesignModel;
}
