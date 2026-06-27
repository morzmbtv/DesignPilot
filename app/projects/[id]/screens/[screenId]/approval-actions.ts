"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SuggestedRule } from "./edit-actions";
import { createFallbackSummary } from "@/lib/design-intelligence";

export type ApproveVersionResult =
  | { ok: true; newRules: SuggestedRule[] }
  | { ok: false; error: string };

export async function approveScreenVersion(
  projectId: string,
  screenId: string,
  versionId: string,
): Promise<ApproveVersionResult> {
  const version = await prisma.screenVersion.findFirst({
    where: { id: versionId, screenId, screen: { projectId } },
    select: {
      id: true,
      newRulesJson: true,
      designSpec: true,
      changeSummary: true,
      screen: {
        select: {
          name: true,
          purpose: true,
          project: { select: { rules: { select: { category: true, name: true, value: true } } } },
        },
      },
    },
  });
  if (!version) return { ok: false, error: "Версия экрана не найдена." };

  const summary = createFallbackSummary({
    screenName: version.screen.name,
    purpose: version.screen.purpose,
    designSpec: version.designSpec,
    changeSummary: version.changeSummary,
    rules: version.screen.project.rules,
  });
  await prisma.$transaction([
    prisma.screen.update({
      where: { id: screenId },
      data: { status: "approved", approvedVersionId: version.id },
    }),
    prisma.screenSummary.upsert({
      where: { screenVersionId: version.id },
      create: { projectId, screenId, screenVersionId: version.id, ...summary },
      update: summary,
    }),
  ]);

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}/memory`);
  revalidatePath(`/projects/${projectId}/screens`);
  revalidatePath(`/projects/${projectId}/screens/${screenId}`);

  return { ok: true, newRules: parseRules(version.newRulesJson) };
}

function parseRules(value: string): SuggestedRule[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((rule) => {
      const candidate = rule as Record<string, unknown>;
      if (
        typeof rule !== "object" ||
        rule === null ||
        typeof candidate.category !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.value !== "string"
      ) {
        return [];
      }
      return [{
        category: candidate.category,
        name: candidate.name,
        value: candidate.value,
        source: typeof candidate.source === "string" ? candidate.source : "ai",
      }];
    });
  } catch {
    return [];
  }
}
