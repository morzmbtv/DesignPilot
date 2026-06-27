import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 text-[22px] font-black tracking-[-0.04em] text-ink">
      <span className="flex size-9 items-center justify-center rounded-xl bg-violet text-lg text-white shadow-[0_8px_20px_rgba(93,61,245,0.22)]">E</span>
      <span>EDUS AI</span>
    </Link>
  );
}
