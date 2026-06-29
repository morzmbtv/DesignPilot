import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/security";

export default async function AccountPage() {
  const user = await requireUser();
  return <AppShell><div className="max-w-2xl"><p className="text-sm font-bold text-violet">Аккаунт</p><h1 className="mt-3 text-4xl font-black">Мой профиль</h1><div className="mt-7 rounded-[22px] border border-line bg-white p-6"><p className="text-lg font-black">{user.name || "Пользователь"}</p><p className="mt-1 text-sm text-muted">{user.email}</p><Link href="/settings/profile" className="mt-6 inline-flex h-11 items-center rounded-xl bg-violet px-5 text-sm font-bold text-white">Открыть настройки</Link></div></div></AppShell>;
}
