import { generateFlutterWidgetTree } from "@/lib/design-code/flutter-tree-generator";
import { generateHtmlLayout } from "@/lib/design-code/html-layout-generator";
import { generateAnimationSpecFromIdm } from "@/lib/idm/animation-generator";
import { generateComponentSuggestionsFromIdm } from "@/lib/idm/component-suggestion-generator";
import { generateDesignSpecFromIdm } from "@/lib/idm/design-spec-generator";
import { generateImagePromptFromIdm } from "@/lib/idm/image-prompt-generator";
import { generateLayoutFromIdm } from "@/lib/idm/layout-generator";
import { normalizeAndValidateIdm } from "@/lib/idm/validator";
import type { CompiledDesignArtifacts, InternalDesignModel } from "@/lib/idm/types";
import { validateLayoutJson } from "@/lib/layout";

type ProjectRule = { category: string; name: string; value: string };

export class DesignCompilerError extends Error {
  constructor(message: string, public readonly validationErrors: string[]) {
    super(message);
    this.name = "DesignCompilerError";
  }
}

export function compileDesignModel(input: unknown, projectRules: ProjectRule[] = []): CompiledDesignArtifacts {
  const { idm, validation } = normalizeAndValidateIdm(input);
  if (!idm) throw new DesignCompilerError("IDM не прошёл базовую проверку.", validation.errors);
  const layoutJson = generateLayoutFromIdm(idm);
  const layoutValidation = validateLayoutJson(layoutJson);
  const mergedValidation = {
    ...validation,
    errors: [...validation.errors, ...layoutValidation.errors.map((error) => `layoutJson: ${error}`)],
    ok: validation.errors.length === 0 && layoutValidation.valid,
  };
  if (!layoutValidation.valid || !layoutValidation.layout) {
    throw new DesignCompilerError("IDM не удалось скомпилировать в валидный Layout JSON.", mergedValidation.errors);
  }

  const designSpec = generateDesignSpecFromIdm(idm);
  const htmlLayout = generateHtmlLayout(layoutValidation.layout, designSpec, projectRules);
  const flutterWidgetTree = generateFlutterWidgetTree(layoutValidation.layout, designSpec, projectRules);
  const imagePrompt = generateImagePromptFromIdm(idm, layoutValidation.layout);
  const animationSpec = generateAnimationSpecFromIdm(idm);
  const componentSuggestions = generateComponentSuggestionsFromIdm(idm, layoutValidation.layout);
  const exportJson = JSON.stringify({
    internalDesignModel: idm,
    artifacts: {
      designSpec,
      layoutJson: layoutValidation.layout,
      htmlLayout,
      flutterWidgetTree,
      imagePrompt,
      animationSpec: JSON.parse(animationSpec),
      componentSuggestions,
      designTokens: idm.theme.tokens,
    },
    validation: mergedValidation,
  }, null, 2);

  return {
    idm,
    validation: mergedValidation,
    designSpec,
    layoutJson: layoutValidation.layout,
    htmlLayout,
    flutterWidgetTree,
    imagePrompt,
    animationSpec,
    componentSuggestions,
    designTokens: idm.theme.tokens,
    exportJson,
  };
}

export function stringifyIdm(idm: InternalDesignModel) {
  return JSON.stringify(idm, null, 2);
}
