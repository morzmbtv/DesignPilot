import type { Metadata } from "next";
import "./globals.css";
import { InterfaceModeProvider } from "@/components/interface-mode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "EDUS AI — Design Prompt Builder",
  description: "Превращайте идеи мобильных приложений в продуманные дизайн-спецификации.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const settings = session?.user?.id
    ? await prisma.userSettings.findUnique({ where: { userId: session.user.id }, select: { interfaceMode: true } })
    : null;
  const initialMode = settings?.interfaceMode === "expert" ? "expert" : "simple";
  return (
    <html lang="ru">
      <body><InterfaceModeProvider initialMode={initialMode}>{children}</InterfaceModeProvider></body>
    </html>
  );
}
