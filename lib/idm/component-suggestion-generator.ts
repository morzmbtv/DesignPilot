import { type LayoutJson } from "@/lib/layout";
import type { InternalDesignModel } from "@/lib/idm/types";

export function generateComponentSuggestionsFromIdm(idm: InternalDesignModel, layoutJson: LayoutJson) {
  return idm.componentSuggestions.map((suggestion) => {
    const elements = layoutJson.elements.filter((element) => suggestion.elementIds.includes(element.id));
    const componentLayout: LayoutJson = {
      viewport: { width: 390, height: 844 },
      elements: elements.length ? elements : layoutJson.elements.slice(0, 1),
    };
    return {
      name: suggestion.name,
      description: suggestion.description,
      category: suggestion.category,
      designSpec: [
        `Компонент: ${suggestion.name}`,
        `Категория: ${suggestion.category}`,
        `Описание: ${suggestion.description}`,
        `Основан на: ${suggestion.basedOnComponentIds.join(", ") || "новый компонент"}`,
        `Причина: ${suggestion.reason}`,
      ].join("\n"),
      imagePrompt: `Create a clean preview of reusable component "${suggestion.name}" for the DesignPilot component library. Preserve exact layoutJson coordinates and project visual language.`,
      layoutJson: componentLayout,
      states: suggestion.states.length ? suggestion.states : ["default"],
      variants: suggestion.variants,
      usageGuidelines: suggestion.usageGuidelines,
      accessibilityNotes: suggestion.accessibilityNotes,
      reason: suggestion.reason,
    };
  });
}
