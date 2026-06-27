import { Dumbbell, Landmark, Plane } from "lucide-react";

export function ProjectIcon({ name }: { name: string }) {
  const Icon = name.toLowerCase().includes("fit") ? Dumbbell : name.toLowerCase().includes("travel") ? Plane : Landmark;
  const coral = name.toLowerCase().includes("travel");
  return (
    <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${coral ? "bg-coral/10 text-coral" : "bg-violet/10 text-violet"}`}>
      <Icon size={27} strokeWidth={1.8} />
    </span>
  );
}
