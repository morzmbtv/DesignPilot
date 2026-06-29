import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/");
  return <AuthPage title="Вход в DesignPilot" subtitle="Ваши проекты доступны на любом компьютере."><AuthForm mode="login" /></AuthPage>;
}

function AuthPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12"><section className="w-full max-w-md rounded-[24px] border border-line bg-white p-7 shadow-soft sm:p-9"><Logo /><h1 className="mt-10 text-3xl font-black tracking-[-0.04em]">{title}</h1><p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>{children}</section></main>;
}
