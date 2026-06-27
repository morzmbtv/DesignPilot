import "server-only";
import type { Prisma } from "@prisma/client";

export const decisionTypes = [
  "global_rule",
  "local_override",
  "component_decision",
  "layout_decision",
  "typography_decision",
  "color_decision",
  "ai_suggestion",
] as const;

export type DecisionInput = {
  type: string;
  target: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  source: string;
  status: string;
};

export function parseDecisions(value: unknown): DecisionInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const decision = item as Record<string, unknown>;
    if (typeof decision.target !== "string" || !decision.target.trim()) return [];
    return [{
      type: typeof decision.type === "string" && decisionTypes.includes(decision.type as typeof decisionTypes[number])
        ? decision.type
        : "ai_suggestion",
      target: decision.target.trim(),
      oldValue: typeof decision.oldValue === "string" ? decision.oldValue.trim() : null,
      newValue: typeof decision.newValue === "string" ? decision.newValue.trim() : null,
      reason: typeof decision.reason === "string" ? decision.reason.trim() : null,
      source: ["user", "ai", "system"].includes(String(decision.source)) ? String(decision.source) : "ai",
      status: "proposed",
    }];
  });
}

export async function saveDecisions(
  tx: Prisma.TransactionClient,
  input: { projectId: string; screenId: string; screenVersionId: string; decisions: DecisionInput[] },
) {
  if (!input.decisions.length) return;
  await tx.designDecision.createMany({
    data: input.decisions.map((decision) => ({
      ...decision,
      projectId: input.projectId,
      screenId: input.screenId,
      screenVersionId: input.screenVersionId,
      status: "proposed",
    })),
  });
}

export function createFallbackSummary(input: {
  screenName: string;
  purpose: string;
  designSpec: string;
  changeSummary: string;
  rules: Array<{ category: string; name: string; value: string }>;
}) {
  const source = `${input.designSpec} ${input.changeSummary}`.toLowerCase();
  const patternMap = [
    ["bottom navigation", "bottom navigation"],
    ["nav", "navigation"],
    ["card", "cards"],
    ["grid", "grid"],
    ["list", "list"],
    ["modal", "modal"],
    ["tab", "tabs"],
    ["form", "form"],
    ["cta", "primary CTA"],
  ] as const;
  const usedPatterns = patternMap.filter(([keyword]) => source.includes(keyword)).map(([, label]) => label);
  const usedRules = input.rules.filter((rule) => {
    const keywords = [rule.category, rule.name, rule.value].map((part) => part.toLowerCase()).filter((part) => part.length > 2);
    return keywords.some((keyword) => source.includes(keyword));
  }).map((rule) => `${rule.category}: ${rule.name} — ${rule.value}`);
  const ctaMatch = input.designSpec.match(/(?:primary\s+)?(?:cta|button)[^.\n:]*[:\-]?\s*([^.\n]{3,80})/i);
  const blocks = input.designSpec
    .split(/\n|(?<=\.)\s+/)
    .map((part) => part.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((part) => part.length > 12)
    .slice(0, 4);

  return {
    summary: `${input.screenName}: ${input.changeSummary || input.purpose || blocks[0] || "утверждённый экран проекта"}`.slice(0, 900),
    mainPurpose: input.purpose || `Основной сценарий экрана ${input.screenName}`,
    primaryUserAction: ctaMatch?.[1]?.trim() || null,
    usedPatterns: JSON.stringify(usedPatterns),
    usedRules: JSON.stringify(usedRules),
    visualNotes: blocks.join(" ").slice(0, 1200) || input.designSpec.slice(0, 1200),
  };
}
