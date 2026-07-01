export const PROJECT_ASSET_TYPES = [
  "logo", "icon", "illustration", "photo", "background", "decoration", "character", "other",
] as const;

export type ProjectAssetType = typeof PROJECT_ASSET_TYPES[number];

export const PROJECT_ASSET_TYPE_LABELS: Record<ProjectAssetType, string> = {
  logo: "Логотип",
  icon: "Иконка",
  illustration: "Иллюстрация",
  photo: "Фотография",
  background: "Фон",
  decoration: "Декор",
  character: "Персонаж",
  other: "Другое",
};

export const ACCEPTED_ASSET_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export const MAX_ASSET_BYTES = 4 * 1024 * 1024;

export function isProjectAssetType(value: string): value is ProjectAssetType {
  return PROJECT_ASSET_TYPES.includes(value as ProjectAssetType);
}

export function assetTypeToIdmType(type: ProjectAssetType) {
  if (type === "icon") return "icon" as const;
  if (type === "character") return "character" as const;
  if (type === "decoration") return "decoration" as const;
  if (type === "background") return "background" as const;
  if (type === "illustration") return "illustration" as const;
  return "image" as const;
}

export function assetSourceUrl(asset: { dataUrl: string | null; fileUrl: string | null }) {
  return asset.dataUrl || asset.fileUrl || "";
}

export function formatAssetSize(value: number | null) {
  if (!value) return "—";
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} КБ`;
  return `${Math.round(value / 1024 / 102.4) / 10} МБ`;
}
