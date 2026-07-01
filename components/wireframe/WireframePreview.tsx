"use client";

import { Lock, MoveDiagonal2 } from "lucide-react";
import type { LayoutElement, LayoutJson } from "@/lib/layout";

export function WireframePreview({ layout, selectedId, onSelect, onChange, snap = true, showGrid = true }: {
  layout: LayoutJson; selectedId: string | null; onSelect: (id: string) => void;
  onChange: (element: LayoutElement) => void; snap?: boolean; showGrid?: boolean;
}) {
  const snapValue = (value: number) => snap ? Math.round(value / 4) * 4 : Math.round(value);
  function begin(event: React.PointerEvent, element: LayoutElement, mode: "move" | "resize") {
    event.stopPropagation();
    onSelect(element.id);
    if (element.locked) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const screen = target.closest("[data-wireframe]")?.getBoundingClientRect();
    if (!screen) return;
    const start = { x: event.clientX, y: event.clientY, element };
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - start.x) * layout.viewport.width / screen.width;
      const dy = (next.clientY - start.y) * layout.viewport.height / screen.height;
      onChange(mode === "move"
        ? { ...element, x: snapValue(start.element.x + dx), y: snapValue(start.element.y + dy) }
        : { ...element, width: Math.max(4, snapValue(start.element.width + dx)), height: Math.max(4, snapValue(start.element.height + dy)) });
    };
    const up = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); };
    target.addEventListener("pointermove", move); target.addEventListener("pointerup", up);
  }
  return (
    <div data-wireframe onPointerDown={() => onSelect("")} className={`relative mx-auto w-full overflow-hidden rounded-[30px] border-[6px] border-ink bg-white shadow-soft ${showGrid ? "wireframe-grid" : ""}`} style={{ maxWidth: Math.min(layout.viewport.width, 720), aspectRatio: `${layout.viewport.width}/${layout.viewport.height}` }}>
      {layout.elements.slice().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((element) => {
        const selected = selectedId === element.id;
        const warning = element.x < 0 || element.y < 0 || element.x + element.width > layout.viewport.width || element.y + element.height > layout.viewport.height;
        return (
          <div key={element.id} onPointerDown={(event) => begin(event, element, "move")}
            className={`absolute flex select-none items-center justify-center overflow-hidden text-center text-[10px] font-bold ${elementClass(element)} ${selected ? "ring-2 ring-blue-500 ring-offset-1" : ""} ${warning ? "bg-red-50 ring-2 ring-red-400" : ""}`}
            style={{ left: `${element.x / layout.viewport.width * 100}%`, top: `${element.y / layout.viewport.height * 100}%`, width: `${element.width / layout.viewport.width * 100}%`, height: `${element.height / layout.viewport.height * 100}%`, borderRadius: element.type === "avatar" ? "999px" : `${element.radius ?? 10}px`, background: element.background === "transparent" ? "transparent" : element.background, opacity: element.opacity ?? 1, zIndex: element.zIndex ?? 0 }}>
            <span className="pointer-events-none truncate px-1">{element.label || element.type}</span>
            {element.locked ? <Lock size={10} className="absolute right-1 top-1" /> : null}
            {selected && !element.locked ? <button aria-label="Resize element" onPointerDown={(event) => begin(event, element, "resize")} className="absolute bottom-0 right-0 flex size-4 items-center justify-center bg-blue-500 text-white"><MoveDiagonal2 size={10} /></button> : null}
          </div>
        );
      })}
    </div>
  );
}
function elementClass(element: LayoutElement) {
  if (element.type === "text") return "text-ink";
  if (element.type === "avatar" || element.type === "icon" || element.type === "progress") return "border border-violet/30 bg-violet/10 text-violet";
  if (element.type === "chip" || element.type === "badge") return "border border-line bg-white";
  if (element.type === "image" || element.type === "illustration") return "border border-dashed border-muted/40 bg-[#f2f3f7] text-muted";
  if (element.type === "background") return "text-muted";
  if (element.type === "decoration") return "border border-blue-100 bg-blue-50 text-blue-600";
  if (element.type === "character") return "border border-dashed border-blue-300 bg-blue-50 text-blue-900";
  if (element.type === "button") return "bg-violet text-white";
  if (element.type === "bottomNav") return "border border-line bg-white shadow-sm";
  return "border border-line bg-[#f7f7fb] text-ink";
}
