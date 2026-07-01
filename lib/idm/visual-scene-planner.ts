import { writeEditorProperties } from "@/lib/idm/editor-properties";
import type { IdmComposition, IdmElement, InternalDesignModel } from "@/lib/idm/types";
import type { StyleDna } from "@/lib/project-config";

type PrimaryLogo = { id: string; name: string; width: number | null; height: number | null } | null;
type SceneType = "splash" | "login" | "onboarding" | "home" | "profile" | "settings" | "landing" | "basic";

type SceneContext = {
  screenName: string;
  screenPurpose: string;
  userRequest: string;
  projectName: string;
  projectType: string;
  platform: string;
  styleDna: StyleDna;
  projectMemory: string;
  projectRules: string[];
  primaryLogo: PrimaryLogo;
};

export type VisualScenePlanResult = {
  idm: InternalDesignModel;
  addedElementIds: string[];
  warnings: string[];
  sceneType: SceneType;
};

export function planVisualScene(idm: InternalDesignModel, context: SceneContext): VisualScenePlanResult {
  const viewport = idm.metadata.viewport;
  const sceneType = detectSceneType(context, viewport.width);
  const palette = paletteFrom(context.styleDna, context.projectType);
  const recipe = buildRecipe(sceneType, context, palette, viewport);
  const warnings = ["splash", "login", "landing"].includes(sceneType) && !context.primaryLogo
    ? ["Основной логотип не загружен. Новый логотип не генерировался."]
    : [];
  const recipeIds = new Set(recipe.map((element) => element.id));
  const replaceTypes = new Set(["background", "decoration"]);
  const pruned = idm.hierarchy.elements.filter((element) => {
    if (element.id === idm.hierarchy.rootId) return true;
    if (recipeIds.has(element.id)) return false;
    if (replaceTypes.has(element.type)) return false;
    if (sceneType === "splash" && isSplashCore(element)) return false;
    return true;
  });
  const rootId = idm.hierarchy.rootId;
  const existingRoot = pruned.find((element) => element.id === rootId);
  const sceneElements = recipe.map((element) => ({ ...element, parent: rootId }));
  const root = {
    ...(existingRoot || createRoot(idm)),
    id: rootId,
    parent: null,
    children: Array.from(new Set([
      ...pruned.filter((element) => element.id !== rootId && element.parent === rootId).map((element) => element.id),
      ...sceneElements.map((element) => element.id),
    ])),
    layout: { ...(existingRoot?.layout || {}), x: 0, y: 0, width: viewport.width, height: viewport.height, visible: true, zIndex: -1 },
    style: { ...(existingRoot?.style || {}), background: palette.background, opacity: 1 },
    constraints: [`viewport:${viewport.width}x${viewport.height}`],
  } satisfies IdmElement;
  const elements = [root, ...pruned.filter((element) => element.id !== rootId), ...sceneElements];
  const ids = new Set(elements.map((element) => element.id));
  root.children = root.children.filter((id) => ids.has(id));

  return {
    idm: {
      ...idm,
      hierarchy: { rootId, elements },
      exportMetadata: {
        ...idm.exportMetadata,
        changeSummary: `${idm.exportMetadata.changeSummary}; Visual Scene Planner: ${sceneType}`,
      },
    },
    addedElementIds: sceneElements.map((element) => element.id),
    warnings,
    sceneType,
  };
}

function buildRecipe(
  sceneType: SceneType,
  context: SceneContext,
  palette: Palette,
  viewport: InternalDesignModel["metadata"]["viewport"],
) {
  if (sceneType === "landing") return landingRecipe(context, palette, viewport);
  if (sceneType === "login") return loginRecipe(context, palette, viewport);
  if (sceneType === "onboarding") return onboardingRecipe(context, palette, viewport);
  if (sceneType === "home") return homeRecipe(context, palette, viewport);
  if (sceneType === "profile") return profileRecipe(context, palette, viewport);
  if (sceneType === "settings") return settingsRecipe(palette, viewport);
  if (sceneType === "splash") return splashRecipe(context, palette, viewport);
  return [backgroundLayer(palette, viewport)];
}

function settingsRecipe(palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return [
    backgroundLayer(palette, viewport),
    textElement("settings_title", "Заголовок настроек", "Настройки", compose("critical", "topLeft", "large", { role: "title", width: "full", maxWidth: 720, height: 56, topOffset: 72, leftOffset: 20, align: "left", avoid: ["safeArea"] }), palette.text, 30, 700),
    surface("settings_list", "Список настроек", "section", compose("content", "center", "large", { role: "settingsList", width: "full", maxWidth: 720, heightRatio: 0.62, maxHeight: 620, horizontalPadding: 20 }), palette.surface, 24),
  ];
}

function splashRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const domain = domainVisual(context.projectType, context);
  return [
    backgroundLayer(palette, viewport),
    visual("background_decoration_large_left", "decoration", "Большой фоновый декор слева", compose("decorative", "topLeft", "large", { widthRatio: 0.56, maxWidth: 230, topOffset: 100, leftOffset: -72, allowOverflow: "partial" }), palette.softDecoration, `${palette.visualLanguage}; translucent rounded abstract shape; ${context.styleDna.backgroundStyle || "soft depth"}`, false, { width: 220, height: 220 }),
    visual("background_decoration_large_right", "decoration", "Большой фоновый декор справа", compose("decorative", "topRight", "large", { widthRatio: 0.58, maxWidth: 240, topOffset: 72, rightOffset: -62, allowOverflow: "partial" }), palette.softDecorationAlt, `${palette.visualLanguage}; translucent rounded abstract shape; premium brand atmosphere`, false, { width: 230, height: 230 }),
    visual("decorative_shape_small_1", "decoration", "Малый декоративный элемент 1", compose("decorative", "centerLeft", "tiny", { widthRatio: 0.1, maxWidth: 40, leftOffset: 28, allowOverflow: "partial" }), palette.accentGradient, `small ${context.styleDna.illustrationStyle || "3D"} abstract brand decoration`, false, { width: 38, height: 38 }),
    visual("decorative_shape_small_2", "decoration", "Малый декоративный элемент 2", compose("decorative", "centerRight", "tiny", { widthRatio: 0.08, maxWidth: 32, rightOffset: 28, allowOverflow: "partial" }), palette.accentGradient, "small subtle brand decoration", false, { width: 30, height: 30 }),
    visual("decorative_shape_small_3", "decoration", "Малый декоративный элемент 3", compose("decorative", "bottomLeft", "tiny", { widthRatio: 0.07, maxWidth: 28, bottomOffset: 130, leftOffset: 36, allowOverflow: "partial" }), palette.accentGradient, "small subtle brand decoration", false, { width: 26, height: 26 }),
    visual("hero_product_visual", domain.type, domain.name, compose("content", "bottomLeft", "large", { role: "heroSupporting", widthRatio: 0.58, maxWidth: 260, bottomOffset: 180, leftOffset: 20, allowOverflow: "none" }), palette.heroGradient, domain.primary, false, { width: 232, height: 194 }),
    visual("hero_character_or_object", domain.secondaryType, domain.secondaryName, compose("content", "bottomRight", "hero", { role: "hero", widthRatio: 0.55, maxWidth: 260, bottomOffset: 170, rightOffset: -20, allowOverflow: "partial" }), palette.heroGradientAlt, domain.secondary, false, { width: 242, height: 302 }),
    logoElement(context.primaryLogo, context.projectName, compose("critical", "center", "medium", { role: "brandLogo", widthRatio: 0.55, maxWidth: 240, maxHeight: 96, allowOverflow: "none" })),
    textElement("loading_text", "Текст загрузки", "Загрузка...", compose("critical", "bottomCenter", "medium", { role: "loadingText", width: "full", height: 48, bottomOffset: 72, horizontalPadding: 20, align: "center", avoid: ["safeArea", "bottomControls"] }), palette.text, 32, 700),
    progressElement(compose("critical", "bottomCenter", "medium", { role: "progress", widthRatio: 0.55, maxWidth: 220, height: 8, bottomOffset: 42, avoid: ["bottomControls"] }), palette),
  ];
}

function loginRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return [
    backgroundLayer(palette, viewport),
    ...genericDecorations(palette),
    logoElement(context.primaryLogo, context.projectName, compose("critical", "topCenter", "medium", { role: "brandLogo", widthRatio: 0.46, maxWidth: 180, maxHeight: 72, topOffset: 72 })),
    surface("login_form_card", "Форма входа", "card", compose("content", "center", "large", { role: "form", width: "full", maxWidth: 420, heightRatio: 0.49, maxHeight: 430, horizontalPadding: 20, allowOverflow: "none" }), palette.surface, 28, { width: 350, height: 410 }),
    textElement("login_title", "Заголовок входа", "Войти", compose("critical", "topCenter", "medium", { role: "title", width: "full", maxWidth: 372, height: 44, topOffset: 220, horizontalPadding: 24 }), palette.text, 30, 700),
    surface("email_input", "Поле email", "input", compose("critical", "topCenter", "medium", { role: "input", width: "full", maxWidth: 372, height: 56, topOffset: 296, horizontalPadding: 24 }), "#FFFFFF", 14),
    surface("password_input", "Поле пароля", "input", compose("critical", "topCenter", "medium", { role: "input", width: "full", maxWidth: 372, height: 56, relationTo: "below:email_input", horizontalPadding: 24 }), "#FFFFFF", 14),
    surface("login_primary_button", "Основная кнопка входа", "button", compose("critical", "topCenter", "medium", { role: "primaryAction", width: "full", maxWidth: 372, height: 60, relationTo: "below:password_input", horizontalPadding: 24 }), palette.primary, 16),
  ];
}

function onboardingRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return [
    backgroundLayer(palette, viewport),
    ...genericDecorations(palette),
    visual("onboarding_hero_visual", "illustration", "Главная иллюстрация", compose("content", "topCenter", "hero", { role: "hero", widthRatio: 0.8, maxWidth: 540, maxHeight: 360, topOffset: 110 }), palette.heroGradient, `${domainVisual(context.projectType, context).primary}; ${palette.visualLanguage}`, false, { width: 320, height: 320 }),
    textElement("onboarding_title", "Заголовок", "Откройте новые возможности", compose("critical", "bottomCenter", "large", { role: "title", width: "full", maxWidth: 680, height: 70, bottomOffset: 300, horizontalPadding: 24 }), palette.text, 30, 700),
    textElement("onboarding_description", "Описание", context.screenPurpose || "Короткое объяснение пользы продукта", compose("critical", "bottomCenter", "large", { role: "description", width: "full", maxWidth: 680, height: 80, bottomOffset: 210, horizontalPadding: 24 }), palette.mutedText, 17, 400),
    progressElement(compose("critical", "bottomCenter", "small", { role: "pagination", width: 96, height: 8, bottomOffset: 165 }), palette, "onboarding_pagination"),
    surface("onboarding_cta", "Кнопка продолжения", "button", compose("critical", "bottomCenter", "large", { role: "primaryAction", width: "full", maxWidth: 540, height: 64, bottomOffset: 40, horizontalPadding: 20, avoid: ["bottomControls"] }), palette.primary, 18),
  ];
}

function homeRecipe(_context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const desktop = viewport.width >= 900;
  return [
    backgroundLayer(palette, viewport),
    surface("app_bar", "Верхняя панель", "section", compose("critical", "topCenter", "full", { role: "appBar", width: "full", height: desktop ? 80 : 104, topOffset: 0, verticalPadding: 0 }), palette.surface, 0),
    surface("summary_card_primary", "Главная карточка", "card", compose("content", "topLeft", "large", { role: "summary", widthRatio: desktop ? 0.3 : 1, maxWidth: 440, height: 170, topOffset: desktop ? 120 : 128, leftOffset: desktop ? 64 : 20 }), palette.heroGradient, 24),
    surface("quick_actions", "Быстрые действия", "section", compose("content", desktop ? "topCenter" : "topLeft", "large", { role: "quickActions", widthRatio: desktop ? 0.35 : 1, maxWidth: 520, height: 120, topOffset: desktop ? 120 : 318, leftOffset: 20 }), palette.surface, 20),
    surface("list_section", "Основной список", "section", compose("content", "bottomCenter", "large", { role: "contentList", width: "full", maxWidth: desktop ? 1312 : 540, heightRatio: desktop ? 0.55 : 0.34, bottomOffset: desktop ? 64 : 98, horizontalPadding: desktop ? 64 : 20, avoid: desktop ? [] : ["bottomControls"] }), palette.surface, 24),
    ...(desktop ? [] : [surface("bottom_navigation", "Нижняя навигация", "bottomNav", compose("critical", "bottomCenter", "full", { role: "bottomControls", width: "full", height: 84, bottomOffset: 0, horizontalPadding: 0 }), "#FFFFFF", 24)]),
  ];
}

function profileRecipe(_context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return [
    backgroundLayer(palette, viewport),
    visual("profile_avatar", "image", "Аватар пользователя", compose("content", "topCenter", "medium", { role: "avatar", width: 104, height: 104, topOffset: 96 }), palette.heroGradient, "user avatar portrait matching project visual language", false, { width: 104, height: 104 }),
    textElement("profile_user_info", "Информация пользователя", "Имя пользователя", compose("critical", "topCenter", "large", { role: "userInfo", width: "full", maxWidth: 540, height: 54, topOffset: 220, horizontalPadding: 20 }), palette.text, 24, 700),
    surface("profile_settings_list", "Настройки профиля", "section", compose("content", "center", "large", { role: "settingsList", width: "full", maxWidth: 540, heightRatio: 0.42, maxHeight: 380, horizontalPadding: 20 }), palette.surface, 24),
    surface("profile_primary_action", "Основное действие", "button", compose("critical", "bottomCenter", "large", { role: "primaryAction", width: "full", maxWidth: 540, height: 60, bottomOffset: 40, horizontalPadding: 20, avoid: ["bottomControls"] }), palette.primary, 16),
  ];
}

function landingRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return [
    backgroundLayer(palette, viewport),
    surface("website_navigation", "Навигация сайта", "section", compose("critical", "topCenter", "full", { role: "navigation", width: "full", height: 88, topOffset: 0, verticalPadding: 0 }), palette.surface, 0),
    logoElement(context.primaryLogo, context.projectName, compose("critical", "topLeft", "small", { role: "brandLogo", width: 160, height: 48, topOffset: 20, leftOffset: 64 })),
    textElement("hero_headline", "Главный заголовок", context.screenPurpose || `${context.projectName} — новый уровень продукта`, compose("critical", "centerLeft", "hero", { role: "headline", widthRatio: 0.42, maxWidth: 600, height: 180, leftOffset: 64, align: "left" }), palette.text, 64, 700),
    textElement("hero_description", "Описание hero", context.userRequest, compose("critical", "centerLeft", "large", { role: "description", widthRatio: 0.4, maxWidth: 560, height: 100, leftOffset: 64, relationTo: "below:hero_headline", align: "left" }), palette.mutedText, 22, 400),
    surface("hero_primary_cta", "Основная CTA", "button", compose("critical", "centerLeft", "medium", { role: "primaryAction", width: 220, height: 64, leftOffset: 64, relationTo: "below:hero_description" }), palette.primary, 16),
    visual("hero_product_visual", domainVisual(context.projectType, context).type, "Hero product visual", compose("content", "centerRight", "hero", { role: "hero", widthRatio: 0.46, maxWidth: 620, maxHeight: 560, rightOffset: 64 }), palette.heroGradient, domainVisual(context.projectType, context).primary, false, { width: 620, height: 520 }),
    surface("feature_cards", "Карточки преимуществ", "section", compose("content", "topCenter", "large", { role: "features", width: "full", maxWidth: 1312, heightRatio: 0.18, maxHeight: 320, relationTo: "below:hero_product_visual", horizontalPadding: 64 }), palette.surface, 28),
  ];
}

function backgroundLayer(palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return visual("screen_background", "background", "Фон экрана", compose("background", "fullScreen", "full", { role: "background", allowOverflow: "full" }), palette.background, `${palette.visualLanguage}; brand background; no text`, true, { width: viewport.width, height: viewport.height });
}

function genericDecorations(palette: Palette) {
  return [
    visual("background_decoration_left", "decoration", "Фоновый декор слева", compose("decorative", "topLeft", "large", { widthRatio: 0.48, maxWidth: 200, topOffset: 90, leftOffset: -60, allowOverflow: "partial" }), palette.softDecoration, `${palette.visualLanguage}; abstract translucent brand decoration`, false, { width: 190, height: 190 }),
    visual("background_decoration_right", "decoration", "Фоновый декор справа", compose("decorative", "bottomRight", "large", { widthRatio: 0.44, maxWidth: 180, bottomOffset: 150, rightOffset: -54, allowOverflow: "partial" }), palette.softDecorationAlt, "abstract translucent brand decoration", false, { width: 170, height: 170 }),
  ];
}

function domainVisual(projectType: string, context: SceneContext) {
  const style = context.styleDna.illustrationStyle || "premium product illustration";
  if (projectType === "fintech_app") return {
    type: "illustration" as const, secondaryType: "decoration" as const,
    name: "Финансовый продукт", secondaryName: "Абстрактный финансовый объект",
    primary: `premium wallet, payment card and coin visual; secure fintech product; ${style}`,
    secondary: `abstract gradient coin or glass financial shape; ${style}`,
  };
  if (projectType === "education_app") return {
    type: "illustration" as const, secondaryType: "character" as const,
    name: hasSchoolContext(context) ? "Школа" : "Образовательная среда",
    secondaryName: hasSchoolContext(context) ? "Ученик" : "Персонаж учащегося",
    primary: hasSchoolContext(context) ? `standalone friendly school building; ${style}` : `friendly learning environment or education product visual; ${style}`,
    secondary: hasSchoolContext(context) ? `friendly student character appropriate for the target audience; ${style}` : `friendly learner character appropriate for the target audience; ${style}`,
  };
  if (projectType === "healthcare_app") return {
    type: "illustration" as const, secondaryType: "decoration" as const,
    name: "Медицинский продукт", secondaryName: "Символ заботы",
    primary: `trustworthy healthcare service visual, wellbeing and care; ${style}`,
    secondary: `soft abstract health shield or wellbeing symbol; ${style}`,
  };
  if (projectType === "ecommerce") return {
    type: "illustration" as const, secondaryType: "decoration" as const,
    name: "Продуктовый visual", secondaryName: "Объект покупки",
    primary: `premium product showcase or shopping experience visual; ${style}`,
    secondary: `abstract shopping bag or featured product object; ${style}`,
  };
  return {
    type: "illustration" as const, secondaryType: "decoration" as const,
    name: "Hero visual", secondaryName: "Фирменный объект",
    primary: `brand-specific product hero visual for ${context.projectName}; ${style}; ${context.styleDna.mood || "modern and confident"}`,
    secondary: `abstract brand object derived from project memory; ${style}`,
  };
}

function hasSchoolContext(context: SceneContext) {
  return /edus|school|student|pupil|школ|ученик|учащ/i.test([
    context.projectName,
    context.projectMemory,
    context.userRequest,
    ...context.projectRules,
  ].join(" "));
}

type Palette = ReturnType<typeof paletteFrom>;
function paletteFrom(style: StyleDna, projectType: string) {
  const primary = firstColor(style.primaryColors) || defaultPrimary(projectType);
  const secondary = firstColor(style.secondaryColors) || "#7DB6FF";
  const background = style.backgroundStyle && /gradient/i.test(style.backgroundStyle)
    ? `linear-gradient(180deg,#FFFFFF 0%,${withAlpha(primary, "16")} 100%)`
    : `linear-gradient(180deg,#FFFFFF 0%,${withAlpha(primary, "12")} 100%)`;
  return {
    primary,
    secondary,
    background,
    surface: "#FFFFFF",
    text: projectType === "fintech_app" ? "#111827" : "#090B3D",
    mutedText: "#667085",
    softDecoration: `linear-gradient(145deg,${withAlpha(primary, "42")},${withAlpha(secondary, "12")})`,
    softDecorationAlt: `linear-gradient(145deg,${withAlpha(secondary, "38")},${withAlpha(primary, "10")})`,
    accentGradient: `linear-gradient(145deg,${secondary},${primary})`,
    heroGradient: `linear-gradient(145deg,${withAlpha(secondary, "45")},${withAlpha(primary, "75")})`,
    heroGradientAlt: `linear-gradient(145deg,${withAlpha(primary, "28")},${withAlpha(secondary, "68")})`,
    visualLanguage: [style.mood, style.illustrationStyle, style.iconStyle].filter(Boolean).join(", ") || "clean premium product style",
  };
}

function visual(
  id: string,
  type: IdmElement["type"],
  name: string,
  composition: IdmComposition,
  background: string,
  description: string,
  locked = false,
  seed?: { width: number; height: number },
): IdmElement {
  return {
    id, type, name, parent: null, children: [],
    layout: unresolvedLayout(type, locked, seed),
    composition,
    style: { background, opacity: 1 },
    animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
    constraints: ["editor:rotation=0", "visual-scene-planner"],
    behavior: [], semanticRole: type,
    content: { text: description, alt: description, assetRole: type },
    componentRef: null, state: {},
  };
}

function logoElement(primaryLogo: PrimaryLogo, projectName: string, composition: IdmComposition): IdmElement {
  const ratio = primaryLogo?.width && primaryLogo.height ? primaryLogo.width / primaryLogo.height : 2.5;
  const element = visual("primary_logo", "image", "Основной логотип", composition, "transparent", primaryLogo ? "uploaded primary logo; place exactly; do not redraw" : "uploaded primary logo required; do not generate", false, { width: 200, height: Math.round(200 / ratio) });
  return {
    ...element,
    semanticRole: "logo",
    constraints: [...element.constraints, "asset:primary-logo", "asset:do-not-redraw"],
    content: { ...element.content, text: projectName, alt: primaryLogo?.name || "Основной логотип", assetRef: primaryLogo?.id, assetRole: "primaryLogo" },
  };
}

function textElement(id: string, name: string, text: string, composition: IdmComposition, color: string, fontSize: number, fontWeight: number) {
  const element: IdmElement = {
    id, type: "text", name, parent: null, children: [],
    layout: { ...unresolvedLayout("text", false, { width: 300, height: 48 }), align: composition.align ?? "center" },
    composition,
    style: { background: "transparent", color, opacity: 1, typography: "project" },
    animation: { type: "fade", durationMs: 360, curve: "easeOut", delayMs: 120 },
    constraints: [], behavior: [], semanticRole: "text",
    content: { text }, componentRef: null, state: {},
  };
  return writeEditorProperties(element, { fontFamily: "project", fontSize, fontWeight, textAlign: "center", rotation: 0 });
}

function surface(id: string, name: string, type: IdmElement["type"], composition: IdmComposition, background: string, radius: number, seed?: { width: number; height: number }): IdmElement {
  return {
    id, type, name, parent: null, children: [],
    layout: { ...unresolvedLayout(type, false, seed), radius },
    composition,
    style: { background, opacity: 1 },
    animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
    constraints: ["visual-scene-planner"], behavior: type === "button" ? ["tap"] : [],
    semanticRole: type, content: { text: name }, componentRef: null, state: {},
  };
}

function progressElement(composition: IdmComposition, palette: Palette, id = "loading_progress"): IdmElement {
  return {
    id, type: "progress", name: "Индикатор прогресса", parent: null, children: [],
    layout: { ...unresolvedLayout("progress", false, { width: 200, height: 8 }), radius: 999 },
    composition,
    style: { background: `linear-gradient(90deg,${palette.primary} 0%,${palette.primary} 42%,#DDE3EF 42%,#DDE3EF 100%)`, color: palette.primary, opacity: 1 },
    animation: { type: "fade", durationMs: 300, curve: "easeOut", delayMs: 250 },
    constraints: [`progress:track=#DDE3EF`, `progress:fill=${palette.primary}`],
    behavior: ["loading-progress"], semanticRole: "progressbar",
    content: { text: "42%" }, componentRef: null, state: { loading: true },
  };
}

function compose(
  priority: NonNullable<IdmComposition["priority"]>,
  anchor: NonNullable<IdmComposition["anchor"]>,
  size: NonNullable<IdmComposition["size"]>,
  rest: Omit<IdmComposition, "priority" | "anchor" | "size"> = {},
): IdmComposition {
  return { priority, anchor, size, allowOverflow: priority === "decorative" ? "partial" : "none", ...rest };
}

function unresolvedLayout(type: IdmElement["type"], locked: boolean, seed?: { width: number; height: number }) {
  const defaults = type === "text" ? { width: 280, height: 48 }
    : type === "progress" ? { width: 200, height: 8 }
      : type === "button" || type === "input" ? { width: 320, height: 56 }
        : { width: 180, height: 180 };
  return {
    x: 0,
    y: 0,
    width: seed?.width ?? defaults.width,
    height: seed?.height ?? defaults.height,
    zIndex: 0,
    radius: type === "background" ? 0 : 24,
    visible: true,
    locked,
    source: "engine" as const,
    manualOverride: false,
  };
}

function createRoot(idm: InternalDesignModel): IdmElement {
  return {
    id: idm.hierarchy.rootId, type: "section", name: idm.metadata.screenName, parent: null, children: [],
    layout: { x: 0, y: 0, width: idm.metadata.viewport.width, height: idm.metadata.viewport.height, zIndex: -1, visible: true, locked: false },
    style: { background: "#FFFFFF", opacity: 1 },
    animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
    constraints: [`viewport:${idm.metadata.viewport.width}x${idm.metadata.viewport.height}`],
    behavior: [], semanticRole: "screen", content: { text: idm.metadata.screenName }, componentRef: null, state: {},
  };
}

function detectSceneType(context: SceneContext, width: number): SceneType {
  const value = `${context.screenName} ${context.screenPurpose} ${context.userRequest}`;
  if (context.projectType === "landing_page" || (width >= 1000 && /landing|hero|главн|home/i.test(value))) return "landing";
  if (/login|sign in|вход|авторизац/i.test(value)) return "login";
  if (/onboarding|онбординг|знакомств/i.test(value)) return "onboarding";
  if (/settings|настройк/i.test(value)) return "settings";
  if (/profile|профил|account/i.test(value)) return "profile";
  if (/dashboard|home|главн|дашборд/i.test(value)) return "home";
  if (/splash|launch|загрузочн|стартов/i.test(value)) return width >= 1000 ? "landing" : "splash";
  return "basic";
}

function isSplashCore(element: IdmElement) {
  if (element.type === "progress") return true;
  if (element.semanticRole === "logo" || element.content.assetRole === "primaryLogo") return true;
  if (element.type === "text" && /загруз|loading/i.test(`${element.name} ${element.content.text || ""}`)) return true;
  return /hero_product_visual|hero_character_or_object/i.test(element.id);
}

function firstColor(value: string) {
  return value.match(/#[0-9a-f]{6}\b/i)?.[0];
}
function withAlpha(color: string, alpha: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}
function defaultPrimary(projectType: string) {
  if (projectType === "fintech_app") return "#635BFF";
  if (projectType === "healthcare_app") return "#12B76A";
  if (projectType === "ecommerce") return "#F04438";
  return "#0967FF";
}
