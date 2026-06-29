"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/auth-actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    try {
      if (mode === "register") {
        const result = await registerUser({
          name: String(formData.get("name") || ""),
          email,
          password,
          passwordConfirmation: String(formData.get("passwordConfirmation") || ""),
        });
        if (!result.ok) return setError(result.error);
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) return setError("Неверный email или пароль");
      router.push("/");
      router.refresh();
    } catch {
      setError(mode === "login" ? "Не удалось войти" : "Не удалось зарегистрироваться");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="mt-8 space-y-5">
      {mode === "register" ? <AuthField name="name" label="Имя" autoComplete="name" required /> : null}
      <AuthField name="email" label="Email" type="email" autoComplete="email" required />
      <AuthField name="password" label="Пароль" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required />
      {mode === "register" ? <AuthField name="passwordConfirmation" label="Повторите пароль" type="password" autoComplete="new-password" minLength={8} required /> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      <button disabled={busy} className="h-12 w-full rounded-xl bg-violet px-5 text-sm font-bold text-white disabled:opacity-60">
        {busy ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
        <Link href={mode === "login" ? "/register" : "/login"} className="font-bold text-violet">
          {mode === "login" ? "Создать аккаунт" : "Войти"}
        </Link>
      </p>
    </form>
  );
}

function AuthField(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return <label className="block text-sm font-bold text-ink">{label}<input {...inputProps} className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-violet" /></label>;
}
