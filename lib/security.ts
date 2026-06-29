import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class AccessDeniedError extends Error {
  constructor() {
    super("Нет доступа");
    this.name = "AccessDeniedError";
  }
}

export const getCurrentUser = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AccessDeniedError();
  return user;
}

export async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new AccessDeniedError();
  return project;
}

export async function assertScreenAccess(screenId: string, userId: string) {
  const screen = await prisma.screen.findFirst({
    where: { id: screenId, project: { userId } },
    select: { id: true, projectId: true },
  });
  if (!screen) throw new AccessDeniedError();
  return screen;
}

export async function assertVersionAccess(versionId: string, userId: string) {
  const version = await prisma.screenVersion.findFirst({
    where: { id: versionId, screen: { project: { userId } } },
    select: { id: true, screenId: true, screen: { select: { projectId: true } } },
  });
  if (!version) throw new AccessDeniedError();
  return version;
}
