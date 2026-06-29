"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security";

export async function saveProfile(input: { name: string; defaultLanguage: string; interfaceMode: string; defaultModel: string }) {
  const user = await requireUser();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false as const, error: "Укажите имя" };
  const interfaceMode = input.interfaceMode === "expert" ? "expert" : "simple";
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name } }),
    prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        defaultLanguage: input.defaultLanguage.trim() || "ru-RU",
        interfaceMode,
        defaultModel: input.defaultModel.trim() || null,
      },
      update: {
        defaultLanguage: input.defaultLanguage.trim() || "ru-RU",
        interfaceMode,
        defaultModel: input.defaultModel.trim() || null,
      },
    }),
  ]);
  revalidatePath("/account");
  revalidatePath("/settings/profile");
  return { ok: true as const };
}

export async function saveInterfaceMode(interfaceMode: "simple" | "expert") {
  const user = await requireUser();
  await prisma.userSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, interfaceMode },
    update: { interfaceMode },
  });
}
