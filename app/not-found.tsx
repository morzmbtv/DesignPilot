import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="py-24 text-center">
        <p className="text-6xl font-black text-violet">404</p>
        <h1 className="mt-4 text-2xl font-black">Проект не найден</h1>
        <Link href="/" className="mt-6 inline-block text-sm font-bold text-violet">Вернуться к проектам</Link>
      </div>
    </AppShell>
  );
}
