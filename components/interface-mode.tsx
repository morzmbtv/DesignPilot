"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { SlidersHorizontal, Sparkles } from "lucide-react";

type InterfaceMode = "simple" | "expert";
const InterfaceModeContext = createContext<{ mode: InterfaceMode; setMode: (mode: InterfaceMode) => void }>({ mode: "simple", setMode: () => {} });

export function InterfaceModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<InterfaceMode>("simple");
  useEffect(() => {
    const saved = window.localStorage.getItem("designpilot-interface-mode");
    if (saved === "expert") setModeState("expert");
  }, []);
  function setMode(next: InterfaceMode) {
    setModeState(next);
    window.localStorage.setItem("designpilot-interface-mode", next);
  }
  return <InterfaceModeContext.Provider value={{ mode, setMode }}>{children}</InterfaceModeContext.Provider>;
}

export function useInterfaceMode() {
  return useContext(InterfaceModeContext);
}

export function InterfaceModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useInterfaceMode();
  return <div className={`grid grid-cols-2 rounded-xl border border-line bg-[#f6f6fa] p-1 ${compact ? "w-[210px]" : "w-full"}`} aria-label="Режим интерфейса">
    <button onClick={() => setMode("simple")} className={`flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold ${mode === "simple" ? "bg-white text-violet shadow-sm" : "text-muted"}`}><Sparkles size={14} /> Простой</button>
    <button onClick={() => setMode("expert")} className={`flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold ${mode === "expert" ? "bg-white text-violet shadow-sm" : "text-muted"}`}><SlidersHorizontal size={14} /> Экспертный</button>
  </div>;
}

export function ModeOnly({ mode: required, children }: { mode: InterfaceMode; children: React.ReactNode }) {
  const { mode } = useInterfaceMode();
  return mode === required ? <>{children}</> : null;
}
