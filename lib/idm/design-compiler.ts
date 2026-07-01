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
import { resolveCompositionLayout } from "@/lib/design-engine/layout-engine";
import { normalizeLayoutToViewport } from "@/lib/design-engine/viewport-normalizer";

type ProjectRule = { category: string; name: string; value: string };

export class DesignCompilerError extends Error {
  constructor(message: string, public readonly validationErrors: string[]) {
    super(message);
    this.name = "DesignCompilerError";
  }
}

export function compileDesignModel(input: unknown, projectRules: ProjectRule[] = []): CompiledDesignArtifacts {
  const initial = normalizeAndValidateIdm(input);
  if (!initial.idm) throw new DesignCompilerError("IDM не прошёл базовую проверку.", initial.validation.errors);
  const engine = resolveCompositionLayout(initial.idm);
  const normalized = normalizeLayoutToViewport(engine.idm, engine.entries);
  const layoutEngine = {
    viewport: { width: initial.idm.metadata.viewport.width, height: initial.idm.metadata.viewport.height },
    entries: normalized.entries,
    warnings: [...engine.warnings, ...normalized.warnings],
  };
  const final = normalizeAndValidateIdm({ ...normalized.idm, layoutEngine });
  if (!final.idm) throw new DesignCompilerError("IDM не прошёл проверку после Layout Engine.", final.validation.errors);
  const idm = final.idm;
  const validation = {
    ok: initial.validation.errors.length === 0 && final.validation.errors.length === 0,
    errors: unique([...initial.validation.errors, ...final.validation.errors]),
    warnings: unique([...initial.validation.warnings, ...final.validation.warnings, ...layoutEngine.warnings]),
    repaired: unique([...initial.validation.repaired, ...final.validation.repaired]),
  };
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

function unique(values: string[]) {
  return Array.from(new Set(values));
}
