import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";

export function reconcileAiEditedIdm(
  previous: InternalDesignModel,
  candidate: InternalDesignModel,
  _userRequest: string,
  deletionConfirmed: boolean,
) {
  const oldById = new Map(previous.hierarchy.elements.map((element) => [element.id, element]));
  const candidateById = new Map(candidate.hierarchy.elements.map((element) => [element.id, element]));
  const removed = previous.hierarchy.elements.filter((element) =>
    element.id !== previous.hierarchy.rootId && !candidateById.has(element.id));
  const confirmationRequired = !deletionConfirmed
    ? removed.filter((element) => !element.layout.locked)
    : [];

  const restored: IdmElement[] = [];
  for (const oldElement of previous.hierarchy.elements) {
    if (oldElement.id === previous.hierarchy.rootId) continue;
    const nextElement = candidateById.get(oldElement.id);
    if (oldElement.layout.locked) {
      candidateById.set(oldElement.id, oldElement);
      if (!nextElement || JSON.stringify(nextElement) !== JSON.stringify(oldElement)) restored.push(oldElement);
      continue;
    }
    if (nextElement && oldElement.content.assetRef && !nextElement.content.assetRef) {
      candidateById.set(oldElement.id, {
        ...nextElement,
        content: {
          ...nextElement.content,
          assetRef: oldElement.content.assetRef,
          assetRole: oldElement.content.assetRole,
        },
      });
      restored.push(oldElement);
      continue;
    }
    if (
      nextElement &&
      oldElement.content.assetRole === "primaryLogo" &&
      nextElement.content.assetRef !== oldElement.content.assetRef &&
      !deletionConfirmed
    ) {
      candidateById.set(oldElement.id, {
        ...nextElement,
        content: {
          ...nextElement.content,
          assetRef: oldElement.content.assetRef,
          assetRole: "primaryLogo",
        },
      });
      confirmationRequired.push(oldElement);
      restored.push(oldElement);
      continue;
    }
    if (!nextElement && !deletionConfirmed) {
      candidateById.set(oldElement.id, oldElement);
      restored.push(oldElement);
    }
  }

  const root = candidateById.get(candidate.hierarchy.rootId) ?? oldById.get(previous.hierarchy.rootId);
  const elements = [
    ...(root ? [root] : []),
    ...Array.from(candidateById.values()).filter((element) => element.id !== candidate.hierarchy.rootId),
  ];
  const ids = new Set(elements.map((element) => element.id));
  const normalizedElements = elements.map((element) => ({
    ...element,
    children: element.children.filter((id) => ids.has(id)),
  }));
  for (const parent of normalizedElements) {
    const directChildren = normalizedElements.filter((element) => element.parent === parent.id).map((element) => element.id);
    parent.children = Array.from(new Set([...parent.children, ...directChildren])).filter((id) => ids.has(id));
  }

  return {
    idm: { ...candidate, hierarchy: { ...candidate.hierarchy, elements: normalizedElements } },
    restoredElements: restored.map(({ id, name }) => ({ id, name })),
    confirmationRequired: confirmationRequired.map(({ id, name }) => ({ id, name })),
  };
}
