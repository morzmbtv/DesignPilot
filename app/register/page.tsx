import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export default async function RegisterPage() {
  if ((await auth())?.user) redirect("/");
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12"><section className="w-full max-w-md rounded-[24px] border border-line bg-white p-7 shadow-soft sm:p-9"><Logo /><h1 className="mt-10 text-3xl font-black tracking-[-0.04em]">Создать аккаунт</h1><p className="mt-2 text-sm leading-6 text-muted">Проекты, версии и библиотека сохранятся в вашем личном пространстве.</p><AuthForm mode="register" /></section></main>;
}
