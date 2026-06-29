"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={
        compact
          ? "flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold text-red-600 hover:bg-red-50"
          : "flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
      }
    >
      <LogOut size={16} /> Выйти
    </button>
  );
}
