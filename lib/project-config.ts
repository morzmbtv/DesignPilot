export const PROJECT_TYPES = [
  "mobile_app", "web_app", "website", "admin_panel", "landing_page", "dashboard",
  "ecommerce", "education_app", "fintech_app", "healthcare_app", "custom",
] as const;
export type ProjectType = typeof PROJECT_TYPES[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  mobile_app: "Мобильное приложение", web_app: "Веб-приложение", website: "Сайт",
  admin_panel: "Админ-панель", landing_page: "Лендинг", dashboard: "Дашборд",
  ecommerce: "Интернет-магазин", education_app: "Образовательное приложение",
  fintech_app: "Финтех-приложение", healthcare_app: "Медицинское приложение",
  custom: "Другое",
};

export const PLATFORMS = ["ios", "android", "responsive_web", "desktop_web", "tablet", "custom"] as const;
export type ProjectPlatform = typeof PLATFORMS[number];
export const PLATFORM_LABELS: Record<ProjectPlatform, string> = {
  ios: "iOS", android: "Android", responsive_web: "Адаптивный веб",
  desktop_web: "Desktop Web", tablet: "Планшет", custom: "Другая",
};

export const VIEWPORT_PRESETS = {
  iphone_390x844: { label: "iPhone 390×844", width: 390, height: 844, safeAreaTop: 44, pagePadding: 20 },
  android_360x800: { label: "Android 360×800", width: 360, height: 800, safeAreaTop: 24, pagePadding: 20 },
  tablet_768x1024: { label: "Tablet 768×1024", width: 768, height: 1024, safeAreaTop: 24, pagePadding: 32 },
  desktop_1440x1024: { label: "Desktop Web 1440×1024", width: 1440, height: 1024, safeAreaTop: 0, pagePadding: 64 },
  landing_1440x3000: { label: "Landing Page 1440×3000", width: 1440, height: 3000, safeAreaTop: 0, pagePadding: 64 },
  custom: { label: "Custom", width: 390, height: 844, safeAreaTop: 0, pagePadding: 20 },
} as const;
export type ViewportPreset = keyof typeof VIEWPORT_PRESETS;

export function isProjectType(value: string): value is ProjectType {
  return PROJECT_TYPES.includes(value as ProjectType);
}
export function isPlatform(value: string): value is ProjectPlatform {
  return PLATFORMS.includes(value as ProjectPlatform);
}
export function isViewportPreset(value: string): value is ViewportPreset {
  return value in VIEWPORT_PRESETS;
}

export type StyleDna = {
  brandName: string; primaryColors: string; secondaryColors: string; typography: string;
  illustrationStyle: string; iconStyle: string; mood: string; layoutDensity: string;
  radiusScale: string; shadowStyle: string; backgroundStyle: string; motionStyle: string;
};

export const EMPTY_STYLE_DNA: StyleDna = {
  brandName: "", primaryColors: "", secondaryColors: "", typography: "",
  illustrationStyle: "", iconStyle: "", mood: "", layoutDensity: "",
  radiusScale: "", shadowStyle: "", backgroundStyle: "", motionStyle: "",
};

export function parseStyleDna(value: string | null | undefined): StyleDna {
  try {
    const parsed = JSON.parse(value || "{}") as Partial<StyleDna>;
    return Object.fromEntries(Object.keys(EMPTY_STYLE_DNA).map((key) => {
      const item = parsed[key as keyof StyleDna];
      return [key, typeof item === "string" ? item : ""];
    })) as StyleDna;
  } catch {
    return { ...EMPTY_STYLE_DNA };
  }
}

export function resolveViewport(input: {
  viewportPreset?: string | null; customViewportWidth?: number | null;
  customViewportHeight?: number | null; platform?: string | null;
}) {
  let preset = input.viewportPreset && input.viewportPreset !== "inherit"
    ? input.viewportPreset
    : defaultPresetForPlatform(input.platform);
  if (!(preset in VIEWPORT_PRESETS)) preset = "iphone_390x844";
  const config = VIEWPORT_PRESETS[preset as ViewportPreset];
  return {
    preset,
    width: preset === "custom" && input.customViewportWidth ? input.customViewportWidth : config.width,
    height: preset === "custom" && input.customViewportHeight ? input.customViewportHeight : config.height,
    safeAreaTop: config.safeAreaTop,
    pagePadding: config.pagePadding,
  };
}

function defaultPresetForPlatform(platform?: string | null) {
  if (platform === "android") return "android_360x800";
  if (platform === "tablet") return "tablet_768x1024";
  if (platform === "desktop_web" || platform === "responsive_web") return "desktop_1440x1024";
  return "iphone_390x844";
}
