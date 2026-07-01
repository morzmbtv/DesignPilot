import "server-only";

import type { OpenRouterMessage } from "@/lib/openrouter";
import type { LayoutJson } from "@/lib/layout";

export type VersionSummary = {
  versionNumber: number;
  designSpec: string;
  imagePrompt: string;
  changeSummary: string;
  layoutJson?: LayoutJson | null;
  internalDesignModel?: unknown | null;
};

export type ScreenEditPromptContext = {
  project: {
    name: string;
    type: string;
    platform: string;
    styleDna: unknown;
    viewport: { width: number; height: number; preset: string };
    styleDirection: string;
    designRequirements: string;
    constraints: string;
  };
  projectRules: Array<{ category: string; name: string; value: string; source: string }>;
  screen: { name: string; purpose: string };
  latestVersion: VersionSummary & { userRequest: string; diff: string };
  assets: {
    primaryLogo: { id: string; name: string } | null;
    available: Array<{ id: string; name: string; type: string; isPrimaryLogo: boolean; isBrandAsset: boolean }>;
  };
};

export type ScreenGenerationPromptContext = {
  project: {
    name: string;
    type: string;
    description: string;
    targetUsers: string;
    appGoal: string;
    platform: string;
    styleDirection: string;
    designRequirements: string;
    architectureNotes: string;
    constraints: string;
    styleDna: unknown;
    viewport: { width: number; height: number; preset: string };
  };
  projectRules: Array<{ category: string; name: string; value: string; source: string }>;
  targetScreen: {
    name: string;
    purpose: string;
    status: string;
    platform: string;
    latestVersion: VersionSummary | null;
  };
  approvedScreens: Array<{
    name: string;
    purpose: string;
    summary?: string;
    approvedVersion: VersionSummary;
  }>;
  relatedScreens: Array<{ name: string; purpose: string; status: string }>;
  designLibrary: {
    source: string;
    approvedComponents: Array<{ id: string; name: string; category: string; description: string; layoutJson: string | null; states: string | null; variants: string | null }>;
    tokens: Array<{ group: string; name: string; value: string }>;
  };
  assets: {
    primaryLogo: { id: string; name: string } | null;
    available: Array<{ id: string; name: string; type: string; isPrimaryLogo: boolean; isBrandAsset: boolean }>;
  };
};

function buildIdmContract(viewport: { width: number; height: number }, platform: string) {
  const lowerStart = Math.round(viewport.height * 0.8);
  const lowerEnd = Math.round(viewport.height * 0.93);
  const topStart = Math.max(0, Math.round(viewport.height * 0.05));
  const topEnd = Math.round(viewport.height * 0.14);
  return `Ты AI Design Model Architect.

Главное правило: верни только Internal Design Model (IDM) — один JSON-объект, без Markdown, без пояснений и без отдельных документов.

Не генерируй Design Spec, HTML, Flutter, Image Prompt или Layout JSON как отдельные поля. DesignPilot сам скомпилирует их из IDM.

IDM — единственный источник истины. Он должен описывать экран, иерархию, абсолютные координаты, стили, motion, interaction, accessibility, component references и draft component suggestions.

Обязательная структура:
{
  "metadata": {
    "id": "stable_id",
    "screenName": "Название экрана",
    "project": "Название проекта",
    "version": 1,
    "viewport": { "width": ${viewport.width}, "height": ${viewport.height}, "safeAreaTop": 0, "pagePadding": 20 },
    "platform": "${platform}",
    "source": "ai",
    "compilerVersion": "idm-v1"
  },
  "hierarchy": {
    "rootId": "screen_root",
    "elements": [
      {
        "id": "screen_root",
        "type": "section",
        "name": "Root screen",
        "parent": null,
        "children": ["title"],
        "layout": { "x": 0, "y": 0, "width": ${viewport.width}, "height": ${viewport.height}, "zIndex": 0, "visible": true, "locked": false },
        "composition": { "role": "background", "anchor": "fullScreen", "size": "full", "allowOverflow": "full", "priority": "background" },
        "style": { "background": "#FFFFFF", "opacity": 1, "typography": "default", "tokenRefs": [] },
        "animation": { "type": "none", "durationMs": 0, "curve": "linear", "delayMs": 0 },
        "constraints": ["viewport:${viewport.width}x${viewport.height}"],
        "behavior": [],
        "semanticRole": "screen",
        "content": { "text": "Screen" },
        "componentRef": null,
        "state": {}
      }
    ]
  },
  "theme": { "tokens": [], "typography": "project default", "colorMode": "light" },
  "motion": { "defaultAnimation": { "type": "none", "durationMs": 0, "curve": "linear", "delayMs": 0 } },
  "interactions": [],
  "dataBinding": [],
  "accessibility": { "notes": [], "minimumTapTarget": 44 },
  "componentSuggestions": [],
  "exportMetadata": { "createdBy": "ai", "createdAt": "ISO date", "changeSummary": "Что создано/изменено", "userRequest": "Запрос пользователя" }
}

Правила элементов:
- type только: text, card, button, icon, avatar, image, illustration, background, decoration, character, bottomNav, section, input, chip, badge, progress.
- Каждый элемент имеет id, type, name, parent, children, layout, style, animation, constraints, behavior, semanticRole, content.
- Для новых элементов описывай относительную composition: role, anchor, size/ratios, offsets, allowOverflow и priority. Не пытайся вручную подгонять все координаты.
- anchor: topLeft, topCenter, topRight, centerLeft, center, centerRight, bottomLeft, bottomCenter, bottomRight или fullScreen.
- priority: background, decorative, content или critical. Layout Engine сам рассчитает финальные x/y/width/height.
- Поле layout оставляй как приблизительный размер/аспект; точное положение будет вычислено Layout Engine.
- Размер viewport всегда бери из project.viewport в контексте. Не подменяй web/tablet viewport мобильным.
- Координаты абсолютные относительно выбранного viewport.
- Важные видимые элементы должны быть в hierarchy.elements.
- Если пользователь просит “внизу”, используй y примерно ${lowerStart}–${lowerEnd}; если есть навигация — размести элемент выше неё.
- Если пользователь просит “сверху”, используй y примерно ${topStart}–${topEnd}.
- Если пользователь просит “по центру”, центрируй по x/y.
- locked=true защищает элемент от AI-изменений; не меняй locked элементы без явной просьбы.
- layout.manualOverride=true означает ручное положение пользователя: сохраняй его без изменений, если пользователь явно не просит переместить этот элемент.
- Не удаляй composition при AI Edit. При ручном override composition остаётся историей исходного замысла.
- Для image/illustration/icon можно использовать content.assetRef и content.assetRole.
- Если в context.assets.primaryLogo есть логотип, используй только его id как content.assetRef и ставь content.assetRole="primaryLogo".
- Не рисуй, не заменяй и не придумывай логотип проекта. Для логотипа допустим только предоставленный primaryLogo assetRef.

Компоненты:
- Сначала используй approved components из designLibrary через componentRef.
- Не дублируй компонентные данные, храни ссылку componentRef.
- Если нового компонента не избежать, добавь запись в componentSuggestions, но не считай её утверждённой.

Запреты:
- Не придумывай новый стиль без причины.
- Визуальный язык бери только из project.styleDna, Project Memory, assets и rules. Не используй знания о других проектах.
- Не меняй утверждённые правила без явного запроса.
- Не используй мелкий текст и перегруженность.
- Не возвращай поля designSpec, imagePrompt, layoutJson, htmlLayout, flutterWidgetTree как top-level поля.
- Верни только валидный JSON-объект IDM.`;
}

export function buildScreenGenerationPrompt(context: ScreenGenerationPromptContext, userRequest: string): OpenRouterMessage[] {
  const request = userRequest.trim();
  if (!request) throw new Error("USER_REQUEST_REQUIRED");
  return [
    { role: "system", content: buildIdmContract(context.project.viewport, context.project.platform) },
    {
      role: "user",
      content: [
        "Создай новый IDM для экрана.",
        "",
        `Запрос пользователя: ${request}`,
        "",
        "Контекст проекта, правила, утверждённые экраны и библиотека компонентов:",
        JSON.stringify(context, null, 2),
      ].join("\n"),
    },
  ];
}

export function buildScreenEditPrompt(context: ScreenEditPromptContext, userRequest: string): OpenRouterMessage[] {
  const request = userRequest.trim();
  if (!request) throw new Error("USER_REQUEST_REQUIRED");
  return [
    { role: "system", content: buildIdmContract(context.project.viewport, context.project.platform) },
    {
      role: "user",
      content: [
        "Отредактируй текущий IDM экрана и верни полный обновлённый IDM.",
        "Измени только то, что явно просит пользователь. Остальные элементы, стили, координаты и componentRef сохрани.",
        "",
        `Правка пользователя: ${request}`,
        "",
        "Текущая версия и контекст:",
        JSON.stringify(context, null, 2),
      ].join("\n"),
    },
  ];
}
