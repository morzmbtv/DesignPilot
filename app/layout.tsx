import type { Metadata } from "next";
import "./globals.css";
import { InterfaceModeProvider } from "@/components/interface-mode";

export const metadata: Metadata = {
  title: "EDUS AI — Design Prompt Builder",
  description: "Превращайте идеи мобильных приложений в продуманные дизайн-спецификации.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body><InterfaceModeProvider>{children}</InterfaceModeProvider></body>
    </html>
  );
}
