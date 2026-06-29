"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SuggestedRule } from "./edit-actions";
import { createFallbackSummary } from "@/lib/design-intelligence";

export type ApproveVersionResult =
  | { ok: true; newRules: SuggestedRule[]; promotedComponents: number }
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
  let promotedComponents = 0;
  try {
    promotedComponents = await prisma.$transaction(async (tx) => {
      const drafts = await tx.designComponent.findMany({
        where: { projectId, sourceScreenVersionId: version.id, status: "draft" },
        select: { id: true, screensUsedIn: true, projectsUsedIn: true, usedInScreens: true, approveHistory: true },
      });
      for (const component of drafts) {
        await tx.designComponent.update({
          where: { id: component.id },
          data: {
            status: "approved",
            approved: true,
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
            screensUsedIn: appendUnique(component.screensUsedIn, screenId),
            usedInScreens: appendUnique(component.usedInScreens, version.screen.name),
            projectsUsedIn: appendUnique(component.projectsUsedIn, projectId),
            approveHistory: appendHistory(component.approveHistory, { status: "approved", source: "screen_approval", screenVersionId: version.id, at: new Date().toISOString() }),
          },
        });
      }
      const remaining = await tx.designComponent.count({
        where: { projectId, sourceScreenVersionId: version.id, status: "draft" },
      });
      if (remaining > 0) throw new Error("COMPONENT_LIBRARY_SYNC_FAILED");
      await tx.screen.update({
        where: { id: screenId },
        data: { status: "approved", approvedVersionId: version.id },
      });
      await tx.screenSummary.upsert({
        where: { screenVersionId: version.id },
        create: { projectId, screenId, screenVersionId: version.id, ...summary },
        update: summary,
      });
      return drafts.length;
    });
  } catch {
    return { ok: false, error: "Новый компонент не был добавлен в библиотеку компонентов." };
  }

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}/memory`);
  revalidatePath(`/projects/${projectId}/screens`);
  revalidatePath(`/projects/${projectId}/screens/${screenId}`);

  return { ok: true, newRules: parseRules(version.newRulesJson), promotedComponents };
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

function appendUnique(value: string | null, item: string) {
  const items = parseJsonArray(value).filter((entry): entry is string => typeof entry === "string");
  if (!items.includes(item)) items.push(item);
  return JSON.stringify(items);
}

function appendHistory(value: string | null, entry: Record<string, unknown>) {
  const items = parseJsonArray(value);
  items.push(entry);
  return JSON.stringify(items);
}

function parseJsonArray(value: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
