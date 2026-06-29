"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertProjectAccess, assertScreenAccess, requireUser } from "@/lib/security";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type ProjectMemoryInput = {
  description: string;
  targetUsers: string;
  appGoal: string;
  platform: string;
  styleDirection: string;
  designRequirements: string;
  architectureNotes: string;
  constraints: string;
};

type ProjectRuleInput = {
  category: string;
  name: string;
  value: string;
  source: string;
};

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const name = value(formData, "name");
  if (!name) throw new Error("Название проекта обязательно");

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name,
      description: value(formData, "description"),
      targetUsers: value(formData, "targetUsers"),
      appGoal: value(formData, "appGoal"),
      platform: value(formData, "platform") || "iOS и Android",
      styleDirection: value(formData, "styleDirection"),
      designRequirements: value(formData, "designRequirements"),
      architectureNotes: value(formData, "architectureNotes"),
      constraints: value(formData, "constraints"),
    },
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}/memory`);
}

export async function updateProject(id: string, formData: FormData) {
  const user = await requireUser();
  await assertProjectAccess(id, user.id);

  await prisma.project.update({
    where: { id },
    data: {
      name: value(formData, "name"),
      description: value(formData, "description"),
      targetUsers: value(formData, "targetUsers"),
      appGoal: value(formData, "appGoal"),
      platform: value(formData, "platform"),
      styleDirection: value(formData, "styleDirection"),
      designRequirements: value(formData, "designRequirements"),
      architectureNotes: value(formData, "architectureNotes"),
      constraints: value(formData, "constraints"),
    },
  });
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/projects/${id}/memory`);
  revalidatePath("/");
}

export async function saveProjectMemory(projectId: string, input: ProjectMemoryInput) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      description: input.description.trim(),
      targetUsers: input.targetUsers.trim(),
      appGoal: input.appGoal.trim(),
      platform: input.platform.trim(),
      styleDirection: input.styleDirection.trim(),
      designRequirements: input.designRequirements.trim(),
      architectureNotes: input.architectureNotes.trim(),
      constraints: input.constraints.trim(),
    },
    select: { updatedAt: true },
  });
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}/memory`);
  return { updatedAt: project.updatedAt.toISOString() };
}

export async function addProjectMemoryRule(projectId: string, input: ProjectRuleInput) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  if (!input.name.trim() || !input.value.trim()) throw new Error("Заполните название и значение правила");

  const rule = await prisma.projectRule.create({
    data: {
      projectId,
      category: input.category.trim() || "Общее",
      name: input.name.trim(),
      value: input.value.trim(),
      source: input.source.trim() || "user",
    },
  });
  revalidatePath(`/projects/${projectId}/memory`);
  return { ...rule, createdAt: rule.createdAt.toISOString(), updatedAt: rule.updatedAt.toISOString() };
}

export async function updateProjectMemoryRule(projectId: string, ruleId: string, input: ProjectRuleInput) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  if (!input.name.trim() || !input.value.trim()) throw new Error("Заполните название и значение правила");

  const current = await prisma.projectRule.findFirst({ where: { id: ruleId, projectId }, select: { id: true } });
  if (!current) throw new Error("Нет доступа");

  const rule = await prisma.projectRule.update({
    where: { id: current.id },
    data: {
      category: input.category.trim() || "Общее",
      name: input.name.trim(),
      value: input.value.trim(),
      source: input.source.trim() || "user",
    },
  });
  revalidatePath(`/projects/${projectId}/memory`);
  return { ...rule, createdAt: rule.createdAt.toISOString(), updatedAt: rule.updatedAt.toISOString() };
}

export async function removeProjectMemoryRule(projectId: string, ruleId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await prisma.projectRule.deleteMany({ where: { id: ruleId, projectId } });
  revalidatePath(`/projects/${projectId}/memory`);
  return { id: ruleId };
}

export async function analyzeProjectRuleImpact(
  projectId: string,
  input: { category?: string; name?: string; target?: string; value?: string },
) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);

  const screens = await prisma.screen.findMany({
    where: { projectId, status: "approved", approvedVersionId: { not: null } },
    include: {
      approvedVersion: { select: { designSpec: true, imagePrompt: true } },
      summaries: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  const keywords = [input.category, input.name, input.target, input.value]
    .flatMap((part) => part?.toLowerCase().split(/[\s/:—_-]+/) ?? [])
    .filter((part) => part.length >= 4);
  const affectedScreens = screens.flatMap((screen) => {
    const summary = screen.summaries[0];
    const haystack = [
      screen.name,
      screen.purpose,
      screen.approvedVersion?.designSpec,
      screen.approvedVersion?.imagePrompt,
      summary?.summary,
      summary?.usedRules,
      summary?.visualNotes,
    ].filter(Boolean).join(" ").toLowerCase();
    const matchedKeywords = Array.from(new Set(keywords.filter((keyword) => haystack.includes(keyword))));
    return matchedKeywords.length ? [{
      id: screen.id,
      name: screen.name,
      summary: summary?.summary || screen.purpose || "Утверждённый экран",
      matchedKeywords,
    }] : [];
  });
  return { count: affectedScreens.length, affectedScreens };
}

export async function deleteProject(id: string) {
  const user = await requireUser();
  await assertProjectAccess(id, user.id);
  await prisma.project.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}

export async function createProjectRule(projectId: string, formData: FormData) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const name = value(formData, "ruleName");
  const ruleValue = value(formData, "ruleValue");
  if (!name || !ruleValue) return;

  await prisma.projectRule.create({
    data: {
      projectId,
      category: value(formData, "category") || "Общее",
      name,
      value: ruleValue,
      source: value(formData, "source") || "user",
    },
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/memory`);
}

export async function deleteProjectRule(projectId: string, ruleId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await prisma.projectRule.deleteMany({ where: { id: ruleId, projectId } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/memory`);
}

export async function createScreen(projectId: string, formData: FormData) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  const name = value(formData, "name");
  if (!name) return;

  const screen = await prisma.screen.create({
    data: {
      projectId,
      name,
      purpose: value(formData, "purpose"),
      status: "draft",
    },
  });
  revalidatePath(`/projects/${projectId}/screens`);
  redirect(`/projects/${projectId}/screens/${screen.id}`);
}

export async function updateScreen(projectId: string, screenId: string, formData: FormData) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);

  await prisma.screen.update({
    where: { id: screenId },
    data: {
      name: value(formData, "name"),
      purpose: value(formData, "purpose"),
    },
  });
  revalidatePath(`/projects/${projectId}/screens`);
  revalidatePath(`/projects/${projectId}/screens/${screenId}`);
}

export async function deleteScreen(projectId: string, screenId: string) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);

  await prisma.screen.delete({ where: { id: screenId } });
  revalidatePath(`/projects/${projectId}/screens`);
  redirect(`/projects/${projectId}/screens`);
}

export async function createScreenVersion(projectId: string, screenId: string, formData: FormData) {
  const user = await requireUser();
  await assertProjectAccess(projectId, user.id);
  await assertScreenAccess(screenId, user.id);

  await prisma.$transaction(async (tx) => {
    const lastVersion = await tx.screenVersion.findFirst({
      where: { screenId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    await tx.screenVersion.create({
      data: {
        screenId,
        versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
        userRequest: value(formData, "userRequest"),
        designSpec: value(formData, "designSpec"),
        imagePrompt: value(formData, "imagePrompt"),
        changeSummary: value(formData, "changeSummary"),
      },
    });
  });
  revalidatePath(`/projects/${projectId}/screens/${screenId}`);
}
