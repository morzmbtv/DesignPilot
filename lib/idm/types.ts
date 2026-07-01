import type { LayoutElementType, LayoutJson } from "@/lib/layout";

export const IDM_COMPILER_VERSION = "idm-v1";

export type IdmViewport = {
  width: number;
  height: number;
  safeAreaTop: number;
  pagePadding: number;
  bottomNavArea?: number;
};

export type IdmLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  align?: string;
  radius?: number;
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  autoLayout?: {
    direction?: "row" | "column";
    gap?: number;
    padding?: number;
  };
};

export type IdmStyle = {
  background?: string;
  opacity?: number;
  typography?: string;
  color?: string;
  elevation?: string;
  tokenRefs?: string[];
};

export type IdmAnimation = {
  type: "none" | "fade" | "scale" | "slide" | "hero" | "sharedTransition";
  durationMs: number;
  curve: string;
  delayMs: number;
};

export type IdmElement = {
  id: string;
  type: LayoutElementType;
  name: string;
  parent: string | null;
  children: string[];
  layout: IdmLayout;
  style: IdmStyle;
  animation: IdmAnimation;
  constraints: string[];
  behavior: string[];
  semanticRole: string;
  content: {
    text?: string;
    alt?: string;
    assetRef?: string;
    assetRole?: string;
    icon?: string;
  };
  componentRef?: {
    componentId: string;
    name: string;
    source: "approved_library" | "draft_component";
  } | null;
  state?: {
    loading?: boolean;
    disabled?: boolean;
    pressed?: boolean;
    focused?: boolean;
    skeleton?: boolean;
    shimmer?: boolean;
  };
};

export type InternalDesignModel = {
  metadata: {
    id: string;
    screenName: string;
    project: string;
    version: number;
    viewport: IdmViewport;
    platform: string;
    source: "ai" | "manual" | "legacy_migration" | "system";
    compilerVersion: typeof IDM_COMPILER_VERSION;
  };
  hierarchy: {
    rootId: string;
    elements: IdmElement[];
  };
  theme: {
    tokens: Array<{ group: string; name: string; value: string }>;
    typography?: string;
    colorMode?: "light";
  };
  motion: {
    defaultAnimation: IdmAnimation;
    screenTransition?: IdmAnimation;
  };
  interactions: Array<{
    elementId: string;
    trigger: "tap" | "longTap" | "swipe" | "drag" | "pull" | "scroll";
    action: string;
    haptic?: string;
  }>;
  dataBinding: Array<{ elementId: string; binding: string }>;
  accessibility: {
    notes: string[];
    minimumTapTarget: number;
  };
  componentSuggestions: Array<{
    name: string;
    description: string;
    category: string;
    basedOnComponentIds: string[];
    reason: string;
    elementIds: string[];
    states: string[];
    variants: string[];
    usageGuidelines: string;
    accessibilityNotes: string;
  }>;
  exportMetadata: {
    createdBy: "ai" | "user" | "system";
    createdAt: string;
    changeSummary: string;
    userRequest?: string;
  };
};

export type IdmCompilerValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  repaired: string[];
};

export type CompiledDesignArtifacts = {
  idm: InternalDesignModel;
  validation: IdmCompilerValidation;
  designSpec: string;
  layoutJson: LayoutJson;
  htmlLayout: string;
  flutterWidgetTree: string;
  imagePrompt: string;
  animationSpec: string;
  componentSuggestions: Array<{
    name: string;
    description: string;
    category: string;
    designSpec: string;
    imagePrompt: string;
    layoutJson: LayoutJson;
    states: string[];
    variants: string[];
    usageGuidelines: string;
    accessibilityNotes: string;
    reason: string;
  }>;
  designTokens: Array<{ group: string; name: string; value: string }>;
  exportJson: string;
};
