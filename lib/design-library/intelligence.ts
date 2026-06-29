import type { LayoutJson } from "@/lib/layout";

export type ComponentCandidate = {
  name: string;
  description?: string;
  category?: string;
  preview?: string;
  screenshot?: string;
  layoutJson?: LayoutJson | null;
  designSpec?: string;
  imagePrompt?: string;
  states?: string[];
  variants?: string[];
  usageGuidelines?: string;
  accessibilityNotes?: string;
  reason?: string;
};

type ExistingComponent = {
  id: string;
  name: string;
  description: string;
  category: string;
  layoutJson: string | null;
  colors: string | null;
  typography: string | null;
  spacing: string | null;
};

const words = (value: string) => new Set(value.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((word) => word.length > 2));

const jaccard = (left: Set<string>, right: Set<string>) => {
  const intersection = Array.from(left).filter((word) => right.has(word)).length;
  const union = new Set(Array.from(left).concat(Array.from(right))).size;
  return union ? intersection / union : 0;
};

export function componentSimilarity(candidate: ComponentCandidate, component: ExistingComponent) {
  const candidateName = candidate.name.trim().toLowerCase();
  const componentName = component.name.trim().toLowerCase();
  if (candidateName === componentName && (candidate.category ?? "Misc") === component.category) return 98;
  const candidateText = words(`${candidate.name} ${candidate.description ?? ""} ${candidate.category ?? ""} ${candidate.designSpec ?? ""}`);
  const componentText = words(`${component.name} ${component.description} ${component.category} ${component.colors ?? ""} ${component.typography ?? ""} ${component.spacing ?? ""}`);
  let score = jaccard(candidateText, componentText) * 75;
  if ((candidate.category ?? "Misc") === component.category) score += 15;
  if (componentName.includes(candidateName) || candidateName.includes(componentName)) score += 12;
  const candidateTypes = new Set(candidate.layoutJson?.elements.map((element) => element.type) ?? []);
  let existingTypes = new Set<string>();
  try {
    existingTypes = new Set(JSON.parse(component.layoutJson || "{}")?.elements?.map((element: { type: string }) => element.type) ?? []);
  } catch {}
  score += jaccard(candidateTypes, existingTypes) * 10;
  return Math.min(100, Math.round(score));
}

export function styleSimilarity(input: { designSpec: string; layoutJson: LayoutJson; tokenValues: string[] }) {
  const haystack = `${input.designSpec} ${JSON.stringify(input.layoutJson)}`.toLowerCase();
  const matched = input.tokenValues.filter((value) => value.length > 2 && haystack.includes(value.toLowerCase()));
  const tokenScore = input.tokenValues.length ? matched.length / input.tokenValues.length : 0.9;
  const reasons: string[] = [];
  const radiusConsistent = /radius|rounded|скруг/i.test(haystack);
  const spacingConsistent = /padding|spacing|gap|отступ/i.test(haystack);
  const typographyConsistent = /font|typography|шрифт/i.test(haystack);
  const score = 70 + tokenScore * 20 + (radiusConsistent ? 3 : 0) + (spacingConsistent ? 4 : 0) + (typographyConsistent ? 3 : 0);
  if (tokenScore < 0.5) reasons.push("Использовано мало токенов библиотеки проекта.");
  if (!radiusConsistent) reasons.push("Не зафиксированы радиусы компонентов.");
  if (!spacingConsistent) reasons.push("Не зафиксирована система отступов.");
  if (!typographyConsistent) reasons.push("Не зафиксирована типографика.");
  return { score: Math.round(Math.min(100, score)), reasons };
}
