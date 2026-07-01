import { writeEditorProperties } from "@/lib/idm/editor-properties";
import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";
import type { StyleDna } from "@/lib/project-config";

type PrimaryLogo = { id: string; name: string; width: number | null; height: number | null } | null;
type SceneType = "splash" | "login" | "onboarding" | "home" | "profile" | "landing" | "basic";

type SceneContext = {
  screenName: string;
  screenPurpose: string;
  userRequest: string;
  projectName: string;
  projectType: string;
  platform: string;
  styleDna: StyleDna;
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
  if (sceneType === "splash") return splashRecipe(context, palette, viewport);
  return [backgroundLayer(palette, viewport)];
}

function splashRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const sx = viewport.width / 390;
  const sy = viewport.height / 844;
  const domain = domainVisual(context.projectType, context);
  return [
    backgroundLayer(palette, viewport),
    visual("background_decoration_large_left", "decoration", "Большой фоновый декор слева", box(-80, 120, 220, 220, 1, sx, sy), palette.softDecoration, `${palette.visualLanguage}; translucent rounded abstract shape; ${context.styleDna.backgroundStyle || "soft depth"}`),
    visual("background_decoration_large_right", "decoration", "Большой фоновый декор справа", box(220, 80, 230, 230, 1, sx, sy), palette.softDecorationAlt, `${palette.visualLanguage}; translucent rounded abstract shape; premium brand atmosphere`),
    visual("decorative_shape_small_1", "decoration", "Малый декоративный элемент 1", box(32, 330, 38, 38, 2, sx, sy), palette.accentGradient, `small ${context.styleDna.illustrationStyle || "3D"} abstract brand decoration`),
    visual("decorative_shape_small_2", "decoration", "Малый декоративный элемент 2", box(326, 350, 30, 30, 2, sx, sy), palette.accentGradient, "small subtle brand decoration"),
    visual("decorative_shape_small_3", "decoration", "Малый декоративный элемент 3", box(38, 682, 26, 26, 2, sx, sy), palette.accentGradient, "small subtle brand decoration"),
    visual("hero_product_visual", domain.type, domain.name, box(28, 468, 232, 194, 3, sx, sy), palette.heroGradient, domain.primary),
    visual("hero_character_or_object", domain.secondaryType, domain.secondaryName, box(178, 418, 242, 302, 4, sx, sy), palette.heroGradientAlt, domain.secondary),
    logoElement(context.primaryLogo, context.projectName, box(75, 290, 240, 96, 5, sx, sy)),
    textElement("loading_text", "Текст загрузки", "Загрузка...", box(0, 730, 390, 48, 6, sx, sy), palette.text, Math.round(32 * Math.min(sx, sy)), 700),
    progressElement(box(95, 790, 200, 8, 6, sx, sy), palette),
  ];
}

function loginRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const w = viewport.width;
  const cardWidth = Math.min(w - 40, 420);
  const x = Math.round((w - cardWidth) / 2);
  return [
    backgroundLayer(palette, viewport),
    ...genericDecorations(palette, viewport),
    logoElement(context.primaryLogo, context.projectName, { x: Math.round((w - 180) / 2), y: 72, width: 180, height: 72, zIndex: 3 }),
    surface("login_form_card", "Форма входа", "card", { x, y: 190, width: cardWidth, height: 410, zIndex: 3 }, palette.surface, 28),
    textElement("login_title", "Заголовок входа", "Войти", { x: x + 24, y: 224, width: cardWidth - 48, height: 44, zIndex: 4 }, palette.text, 30, 700),
    surface("email_input", "Поле email", "input", { x: x + 24, y: 300, width: cardWidth - 48, height: 56, zIndex: 4 }, "#FFFFFF", 14),
    surface("password_input", "Поле пароля", "input", { x: x + 24, y: 372, width: cardWidth - 48, height: 56, zIndex: 4 }, "#FFFFFF", 14),
    surface("login_primary_button", "Основная кнопка входа", "button", { x: x + 24, y: 460, width: cardWidth - 48, height: 60, zIndex: 4 }, palette.primary, 16),
  ];
}

function onboardingRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const w = viewport.width;
  return [
    backgroundLayer(palette, viewport),
    ...genericDecorations(palette, viewport),
    visual("onboarding_hero_visual", "illustration", "Главная иллюстрация", { x: w * 0.1, y: 110, width: w * 0.8, height: 320, zIndex: 3 }, palette.heroGradient, `${domainVisual(context.projectType, context).primary}; ${palette.visualLanguage}`),
    textElement("onboarding_title", "Заголовок", "Откройте новые возможности", { x: 24, y: 470, width: w - 48, height: 70, zIndex: 4 }, palette.text, 30, 700),
    textElement("onboarding_description", "Описание", context.screenPurpose || "Короткое объяснение пользы продукта", { x: 24, y: 548, width: w - 48, height: 80, zIndex: 4 }, palette.mutedText, 17, 400),
    progressElement({ x: w / 2 - 48, y: 660, width: 96, height: 8, zIndex: 4 }, palette, "onboarding_pagination"),
    surface("onboarding_cta", "Кнопка продолжения", "button", { x: 20, y: viewport.height - 104, width: w - 40, height: 64, zIndex: 5 }, palette.primary, 18),
  ];
}

function homeRecipe(_context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const w = viewport.width;
  const desktop = w >= 900;
  return [
    backgroundLayer(palette, viewport),
    surface("app_bar", "Верхняя панель", "section", { x: 0, y: 0, width: w, height: desktop ? 80 : 104, zIndex: 2 }, palette.surface, 0),
    surface("summary_card_primary", "Главная карточка", "card", { x: desktop ? 64 : 20, y: desktop ? 120 : 128, width: desktop ? 420 : w - 40, height: 170, zIndex: 3 }, palette.heroGradient, 24),
    surface("quick_actions", "Быстрые действия", "section", { x: desktop ? 508 : 20, y: desktop ? 120 : 318, width: desktop ? 500 : w - 40, height: 120, zIndex: 3 }, palette.surface, 20),
    surface("list_section", "Основной список", "section", { x: desktop ? 64 : 20, y: desktop ? 320 : 466, width: desktop ? w - 128 : w - 40, height: desktop ? 560 : 280, zIndex: 3 }, palette.surface, 24),
    ...(desktop ? [] : [surface("bottom_navigation", "Нижняя навигация", "bottomNav", { x: 0, y: viewport.height - 84, width: w, height: 84, zIndex: 8 }, "#FFFFFF", 24)]),
  ];
}

function profileRecipe(_context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const w = viewport.width;
  return [
    backgroundLayer(palette, viewport),
    visual("profile_avatar", "image", "Аватар пользователя", { x: w / 2 - 52, y: 96, width: 104, height: 104, zIndex: 3 }, palette.heroGradient, "user avatar portrait matching project visual language"),
    textElement("profile_user_info", "Информация пользователя", "Имя пользователя", { x: 20, y: 220, width: w - 40, height: 54, zIndex: 4 }, palette.text, 24, 700),
    surface("profile_settings_list", "Настройки профиля", "section", { x: 20, y: 302, width: w - 40, height: 350, zIndex: 3 }, palette.surface, 24),
    surface("profile_primary_action", "Основное действие", "button", { x: 20, y: Math.min(viewport.height - 100, 690), width: w - 40, height: 60, zIndex: 4 }, palette.primary, 16),
  ];
}

function landingRecipe(context: SceneContext, palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  const w = viewport.width;
  const content = Math.min(1280, w - 128);
  const left = Math.round((w - content) / 2);
  return [
    backgroundLayer(palette, viewport),
    surface("website_navigation", "Навигация сайта", "section", { x: 0, y: 0, width: w, height: 88, zIndex: 3 }, palette.surface, 0),
    logoElement(context.primaryLogo, context.projectName, { x: left, y: 24, width: 160, height: 48, zIndex: 4 }),
    textElement("hero_headline", "Главный заголовок", context.screenPurpose || `${context.projectName} — новый уровень продукта`, { x: left, y: 210, width: content * 0.48, height: 180, zIndex: 4 }, palette.text, 64, 700),
    textElement("hero_description", "Описание hero", context.userRequest, { x: left, y: 410, width: content * 0.42, height: 100, zIndex: 4 }, palette.mutedText, 22, 400),
    surface("hero_primary_cta", "Основная CTA", "button", { x: left, y: 550, width: 220, height: 64, zIndex: 4 }, palette.primary, 16),
    visual("hero_product_visual", domainVisual(context.projectType, context).type, "Hero product visual", { x: left + content * 0.52, y: 150, width: content * 0.48, height: 520, zIndex: 3 }, palette.heroGradient, domainVisual(context.projectType, context).primary),
    surface("feature_cards", "Карточки преимуществ", "section", { x: left, y: 760, width: content, height: 420, zIndex: 3 }, palette.surface, 28),
  ];
}

function backgroundLayer(palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return visual("screen_background", "background", "Фон экрана", { x: 0, y: 0, width: viewport.width, height: viewport.height, zIndex: 0 }, palette.background, `${palette.visualLanguage}; brand background; no text`, true);
}

function genericDecorations(palette: Palette, viewport: InternalDesignModel["metadata"]["viewport"]) {
  return [
    visual("background_decoration_left", "decoration", "Фоновый декор слева", { x: -70, y: 100, width: 190, height: 190, zIndex: 1 }, palette.softDecoration, `${palette.visualLanguage}; abstract translucent brand decoration`),
    visual("background_decoration_right", "decoration", "Фоновый декор справа", { x: viewport.width - 110, y: viewport.height * 0.62, width: 170, height: 170, zIndex: 1 }, palette.softDecorationAlt, "abstract translucent brand decoration"),
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
    name: "Образовательная среда", secondaryName: "Персонаж учащегося",
    primary: `friendly learning environment or education product visual; ${style}`,
    secondary: `friendly learner character appropriate for the target audience; ${style}`,
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

function visual(id: string, type: IdmElement["type"], name: string, layout: Box, background: string, description: string, locked = false): IdmElement {
  return {
    id, type, name, parent: null, children: [],
    layout: { ...layout, radius: type === "background" ? 0 : 24, visible: true, locked },
    style: { background, opacity: 1 },
    animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
    constraints: ["editor:rotation=0", "visual-scene-planner"],
    behavior: [], semanticRole: type,
    content: { text: description, alt: description, assetRole: type },
    componentRef: null, state: {},
  };
}

function logoElement(primaryLogo: PrimaryLogo, projectName: string, layout: Box): IdmElement {
  const element = visual("primary_logo", "image", "Основной логотип", layout, "transparent", primaryLogo ? "uploaded primary logo; place exactly; do not redraw" : "uploaded primary logo required; do not generate");
  return {
    ...element,
    semanticRole: "logo",
    constraints: [...element.constraints, "asset:primary-logo", "asset:do-not-redraw"],
    content: { ...element.content, text: projectName, alt: primaryLogo?.name || "Основной логотип", assetRef: primaryLogo?.id, assetRole: "primaryLogo" },
  };
}

function textElement(id: string, name: string, text: string, layout: Box, color: string, fontSize: number, fontWeight: number) {
  const element: IdmElement = {
    id, type: "text", name, parent: null, children: [],
    layout: { ...layout, align: "center", visible: true, locked: false },
    style: { background: "transparent", color, opacity: 1, typography: "project" },
    animation: { type: "fade", durationMs: 360, curve: "easeOut", delayMs: 120 },
    constraints: [], behavior: [], semanticRole: "text",
    content: { text }, componentRef: null, state: {},
  };
  return writeEditorProperties(element, { fontFamily: "project", fontSize, fontWeight, textAlign: "center", rotation: 0 });
}

function surface(id: string, name: string, type: IdmElement["type"], layout: Box, background: string, radius: number): IdmElement {
  return {
    id, type, name, parent: null, children: [],
    layout: { ...layout, radius, visible: true, locked: false },
    style: { background, opacity: 1 },
    animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
    constraints: ["visual-scene-planner"], behavior: type === "button" ? ["tap"] : [],
    semanticRole: type, content: { text: name }, componentRef: null, state: {},
  };
}

function progressElement(layout: Box, palette: Palette, id = "loading_progress"): IdmElement {
  return {
    id, type: "progress", name: "Индикатор прогресса", parent: null, children: [],
    layout: { ...layout, radius: 999, visible: true, locked: false },
    style: { background: `linear-gradient(90deg,${palette.primary} 0%,${palette.primary} 42%,#DDE3EF 42%,#DDE3EF 100%)`, color: palette.primary, opacity: 1 },
    animation: { type: "fade", durationMs: 300, curve: "easeOut", delayMs: 250 },
    constraints: [`progress:track=#DDE3EF`, `progress:fill=${palette.primary}`],
    behavior: ["loading-progress"], semanticRole: "progressbar",
    content: { text: "42%" }, componentRef: null, state: { loading: true },
  };
}

type Box = { x: number; y: number; width: number; height: number; zIndex: number };
function box(x: number, y: number, width: number, height: number, zIndex: number, sx: number, sy: number): Box {
  return { x: Math.round(x * sx), y: Math.round(y * sy), width: Math.round(width * sx), height: Math.round(height * sy), zIndex };
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
