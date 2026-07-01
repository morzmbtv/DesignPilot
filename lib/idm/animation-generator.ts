import type { InternalDesignModel } from "@/lib/idm/types";

export function generateAnimationSpecFromIdm(idm: InternalDesignModel) {
  const items = idm.hierarchy.elements
    .filter((element) => element.animation.type !== "none")
    .map((element) => ({
      elementId: element.id,
      type: element.animation.type,
      durationMs: element.animation.durationMs,
      curve: element.animation.curve,
      delayMs: element.animation.delayMs,
    }));
  return JSON.stringify({
    screenTransition: idm.motion.screenTransition ?? null,
    defaultAnimation: idm.motion.defaultAnimation,
    elements: items,
  }, null, 2);
}
