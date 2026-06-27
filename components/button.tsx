import Link from "next/link";
import type { ComponentProps } from "react";

const styles =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-none";

export function ButtonLink({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return <Link className={`${styles} bg-violet text-white shadow-soft hover:bg-[#4e30df] ${className}`} {...props} />;
}

export function SecondaryLink({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return <Link className={`${styles} border border-line bg-white text-ink hover:border-violet/30 ${className}`} {...props} />;
}
