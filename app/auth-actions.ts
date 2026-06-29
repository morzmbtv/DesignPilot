"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registrationSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(80),
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(128),
  passwordConfirmation: z.string(),
}).refine((value) => value.password === value.passwordConfirmation, {
  message: "Пароли не совпадают",
  path: ["passwordConfirmation"],
});

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}) {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Проверьте данные" };

  const passwordHash = await hash(parsed.data.password, 12);
  try {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing?.passwordHash) return { ok: false as const, error: "Пользователь с таким email уже существует" };

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          passwordHash,
          settings: { upsert: { create: {}, update: {} } },
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          settings: { create: {} },
        },
      });
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Не удалось создать аккаунт" };
  }
}
