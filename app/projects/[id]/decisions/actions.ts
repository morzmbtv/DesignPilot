"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function setDecisionStatus(projectId: string, decisionId: string, status: "approved" | "rejected") {
  const result = await prisma.designDecision.updateMany({
    where: { id: decisionId, projectId },
    data: { status },
  });
  if (!result.count) return { ok: false as const, error: "Решение не найдено." };
  revalidatePath(`/projects/${projectId}/decisions`);
  return { ok: true as const };
}

export async function promoteDecisionToRule(projectId: string, decisionId: string) {
  const decision = await prisma.designDecision.findFirst({ where: { id: decisionId, projectId } });
  if (!decision) return { ok: false as const, error: "Решение не найдено." };
  const value = decision.newValue || decision.reason;
  if (!value) return { ok: false as const, error: "У решения нет значения для правила." };
  const category = decision.type === "global_rule" ? "Global" : "Design Decision";
  const existing = await prisma.projectRule.findFirst({
    where: { projectId, category, name: decision.target },
    select: { id: true },
  });
  if (existing) {
    await prisma.projectRule.update({ where: { id: existing.id }, data: { value, source: decision.source } });
  } else {
    await prisma.projectRule.create({
      data: { projectId, category, name: decision.target, value, source: decision.source },
    });
  }
  await prisma.designDecision.update({ where: { id: decision.id }, data: { status: "approved" } });
  revalidatePath(`/projects/${projectId}/decisions`);
  revalidatePath(`/projects/${projectId}/memory`);
  return { ok: true as const, mode: existing ? "updated" as const : "created" as const };
}
