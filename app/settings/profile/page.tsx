import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  return <AppShell><div className="max-w-3xl"><p className="text-sm font-bold text-violet">Настройки</p><h1 className="mt-3 text-4xl font-black">Мой профиль</h1><p className="mt-2 text-sm text-muted">Настройки хранятся в аккаунте и доступны на любом компьютере.</p><div className="mt-7 rounded-[22px] border border-line bg-white p-6"><ProfileForm initial={{ name: user.name || "", email: user.email, defaultLanguage: settings?.defaultLanguage || "ru-RU", interfaceMode: settings?.interfaceMode || "simple", defaultModel: settings?.defaultModel || "" }} /></div></div></AppShell>;
}
