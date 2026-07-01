export const layoutElementTypes = [
  "text", "card", "button", "icon", "avatar", "image", "illustration",
  "bottomNav", "section", "input", "chip", "badge", "progress",
  "background", "decoration", "character",
] as const;

export type LayoutElementType = typeof layoutElementTypes[number];
export type LayoutElement = {
  id: string; type: LayoutElementType; label: string;
  x: number; y: number; width: number; height: number;
  align?: string; style?: string; radius?: number; background?: string;
  opacity?: number; zIndex?: number; locked?: boolean;
  rotation?: number; color?: string; fontFamily?: string; fontSize?: number;
  fontWeight?: number; visible?: boolean; componentRef?: string; assetRef?: string;
  assetRole?: string;
};
export type LayoutJson = { viewport: { width: number; height: number }; elements: LayoutElement[] };

export function validateLayoutJson(value: unknown): { valid: boolean; errors: string[]; layout: LayoutJson | null } {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valid: false, errors: ["layoutJson должен быть объектом"], layout: null };
  const candidate = value as Record<string, unknown>;
  const viewport = candidate.viewport as Record<string, unknown> | undefined;
  const viewportWidth = Number(viewport?.width);
  const viewportHeight = Number(viewport?.height);
  if (!Number.isFinite(viewportWidth) || viewportWidth < 240 || viewportWidth > 5000) errors.push("viewport.width должен быть от 240 до 5000");
  if (!Number.isFinite(viewportHeight) || viewportHeight < 320 || viewportHeight > 10000) errors.push("viewport.height должен быть от 320 до 10000");
  if (!Array.isArray(candidate.elements)) errors.push("elements должен быть массивом");
  const elements = Array.isArray(candidate.elements) ? candidate.elements : [];
  const ids = new Set<string>();
  elements.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push(`elements[${index}] должен быть объектом`); return; }
    const element = raw as Record<string, unknown>;
    const id = typeof element.id === "string" ? element.id.trim() : "";
    if (!id) errors.push(`elements[${index}].id обязателен`);
    else if (ids.has(id)) errors.push(`Повторяющийся id элемента: ${id}`); else ids.add(id);
    if (typeof element.type !== "string" || !layoutElementTypes.includes(element.type as LayoutElementType)) errors.push(`elements[${index}].type некорректен`);
    for (const field of ["x", "y", "width", "height"] as const) if (typeof element[field] !== "number" || !Number.isFinite(element[field])) errors.push(`elements[${index}].${field} должен быть конечным числом`);
    const x = Number(element.x), y = Number(element.y), width = Number(element.width), height = Number(element.height);
    if (Number.isFinite(width) && width < 4) errors.push(`elements[${index}].width должен быть не меньше 4`);
    if (Number.isFinite(height) && height < 4) errors.push(`elements[${index}].height должен быть не меньше 4`);
    // Viewport overflow исправляет Smart Viewport Normalizer до компиляции.
    // Здесь проверяется только структурная валидность чисел и размеров.
  });
  return { valid: errors.length === 0, errors, layout: errors.length ? null : value as LayoutJson };
}
export function parseLayoutJson(value: string | null | undefined) {
  if (!value) return { valid: false, errors: ["Layout JSON пока отсутствует."], layout: null as LayoutJson | null };
  try { return validateLayoutJson(JSON.parse(value)); } catch { return { valid: false, errors: ["layoutJson содержит некорректный JSON"], layout: null as LayoutJson | null }; }
}
export function createBlankLayout(label = "Новый элемент"): LayoutJson {
  return { viewport: { width: 390, height: 844 }, elements: [{ id: "section_1", type: "section", label, x: 20, y: 120, width: 350, height: 160, radius: 20, background: "#F3F3F8", opacity: 1, zIndex: 1, locked: false }] };
}
