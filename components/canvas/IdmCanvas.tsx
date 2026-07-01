"use client";

import { ImageIcon, LockKeyhole, MoveDiagonal2, Shapes, Sparkles, UserRound } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";
import { readEditorProperties } from "@/lib/idm/editor-properties";

type Props = {
  idm: InternalDesignModel;
  selectedId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  snap: boolean;
  showGrid: boolean;
  showSafeArea: boolean;
  showRulers: boolean;
  panMode: boolean;
  onPanChange: (pan: { x: number; y: number }) => void;
  onSelect: (id: string | null) => void;
  onChange: (element: IdmElement) => void;
  assets: Array<{ id: string; name: string; dataUrl: string | null; fileUrl: string | null }>;
};

export function IdmCanvas({
  idm, selectedId, zoom, pan, snap, showGrid, showSafeArea, showRulers, panMode,
  onPanChange, onSelect, onChange, assets,
}: Props) {
  const root = idm.hierarchy.elements.find((element) => element.id === idm.hierarchy.rootId);
  const viewport = idm.metadata.viewport;
  const elements = idm.hierarchy.elements
    .filter((element) => element.id !== idm.hierarchy.rootId && element.layout.visible !== false)
    .slice()
    .sort((a, b) => (a.layout.zIndex ?? 0) - (b.layout.zIndex ?? 0));
  const snapValue = (value: number) => snap ? Math.round(value / 4) * 4 : Math.round(value);

  function beginElement(event: ReactPointerEvent<HTMLElement>, element: IdmElement, mode: "move" | "resize") {
    event.stopPropagation();
    onSelect(element.id);
    if (element.layout.locked || panMode) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { clientX: event.clientX, clientY: event.clientY, element };
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - start.clientX) / zoom;
      const dy = (next.clientY - start.clientY) / zoom;
      const layout = mode === "move"
        ? {
            ...start.element.layout,
            x: clamp(snapValue(start.element.layout.x + dx), -20, viewport.width + 20 - start.element.layout.width),
            y: clamp(snapValue(start.element.layout.y + dy), -20, viewport.height + 20 - start.element.layout.height),
          }
        : {
            ...start.element.layout,
            width: clamp(snapValue(start.element.layout.width + dx), 4, viewport.width + 20 - start.element.layout.x),
            height: clamp(snapValue(start.element.layout.height + dy), 4, viewport.height + 20 - start.element.layout.y),
          };
      onChange({ ...start.element, layout });
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panMode && event.button !== 1) {
      onSelect(null);
      return;
    }
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { clientX: event.clientX, clientY: event.clientY, pan };
    const move = (next: PointerEvent) => onPanChange({
      x: start.pan.x + next.clientX - start.clientX,
      y: start.pan.y + next.clientY - start.clientY,
    });
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }

  return (
    <div
      data-testid="idm-canvas-viewport"
      onPointerDown={beginPan}
      className={`relative h-[760px] min-h-[540px] overflow-hidden bg-[#e8e9ee] ${panMode ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div
        className="absolute left-1/2 top-8 origin-top-left"
        style={{ transform: `translate(calc(-50% + ${pan.x}px), ${pan.y}px) scale(${zoom})` }}
      >
        {showRulers ? <Rulers width={viewport.width} height={viewport.height} /> : null}
        <div
          data-testid="idm-canvas"
          className={`relative overflow-hidden bg-white shadow-[0_24px_80px_rgba(17,19,38,0.22)] ${showGrid ? "canvas-grid" : ""}`}
          style={{ width: viewport.width, height: viewport.height, background: root?.style.background || "#FFFFFF" }}
        >
          {showSafeArea ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 z-[9998] border-t border-dashed border-sky-400/70" style={{ top: viewport.safeAreaTop }} />
              <span className="pointer-events-none absolute left-2 top-2 z-[9998] rounded bg-sky-50/90 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">Safe Area {viewport.safeAreaTop}</span>
            </>
          ) : null}
          {elements.map((element) => {
            const selected = selectedId === element.id;
            const warning = isOutside(element, viewport.width, viewport.height);
            const editor = readEditorProperties(element);
            const asset = element.content.assetRef ? assets.find((item) => item.id === element.content.assetRef) : null;
            return (
              <div
                key={element.id}
                data-testid={`canvas-element-${element.id}`}
                onPointerDown={(event) => beginElement(event, element, "move")}
                className={`absolute flex select-none items-center justify-center overflow-hidden text-center text-[11px] font-bold transition-shadow ${elementClass(element)} ${selected ? "ring-2 ring-blue-500 ring-offset-1" : ""} ${warning ? "ring-2 ring-red-500" : ""}`}
                style={{
                  left: element.layout.x,
                  top: element.layout.y,
                  width: element.layout.width,
                  height: element.layout.height,
                  transform: `rotate(${editor.rotation}deg)`,
                  borderRadius: element.type === "avatar" ? 999 : element.layout.radius ?? 0,
                  background: element.style.background || undefined,
                  color: element.style.color || undefined,
                  opacity: element.style.opacity ?? 1,
                  zIndex: element.layout.zIndex ?? 1,
                  fontFamily: editor.fontFamily || undefined,
                  fontSize: editor.fontSize,
                  fontWeight: editor.fontWeight,
                  textAlign: editor.textAlign,
                }}
              >
                {asset?.dataUrl || asset?.fileUrl
                  ? <img
                      src={asset.dataUrl || asset.fileUrl || ""}
                      alt={element.content.alt || asset.name}
                      draggable={false}
                      className={`pointer-events-none size-full ${element.type === "background" ? "object-cover" : "object-contain"}`}
                    />
                  : <ElementFallback element={element} />}
                {element.layout.locked ? <LockKeyhole size={12} className="pointer-events-none absolute right-1 top-1 text-amber-600" /> : null}
                {selected && !element.layout.locked ? (
                  <button
                    type="button"
                    aria-label="Изменить размер"
                    onPointerDown={(event) => beginElement(event, element, "resize")}
                    className="absolute bottom-0 right-0 flex size-5 cursor-nwse-resize items-center justify-center bg-blue-600 text-white"
                  >
                    <MoveDiagonal2 size={11} />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Rulers({ width, height }: { width: number; height: number }) {
  const horizontal = ticks(width, width > 800 ? 200 : 50);
  const vertical = ticks(height, height > 1200 ? 250 : 100);
  return (
    <>
      <div className="pointer-events-none absolute -top-5 left-0 h-5 border-b border-slate-400 bg-slate-100 text-[8px] text-slate-500" style={{ width }}>
        {horizontal.map((value) => <span key={value} className="absolute bottom-0 border-l border-slate-400 pl-1" style={{ left: value }}>{value}</span>)}
      </div>
      <div className="pointer-events-none absolute -left-7 top-0 w-7 border-r border-slate-400 bg-slate-100 text-[8px] text-slate-500" style={{ height }}>
        {vertical.map((value) => <span key={value} className="absolute right-0 border-t border-slate-400 pr-1" style={{ top: value }}>{value}</span>)}
      </div>
    </>
  );
}

function elementClass(element: IdmElement) {
  if (element.type === "text") return "text-ink";
  if (element.type === "avatar") return "border border-violet/30 bg-violet/10";
  if (element.type === "icon" || element.type === "progress") return "border border-violet/30 bg-violet/10 text-violet";
  if (element.type === "chip" || element.type === "badge") return "border border-line bg-white";
  if (element.type === "image" || element.type === "illustration") return "text-slate-600";
  if (element.type === "background") return "text-slate-500";
  if (element.type === "decoration") return "text-blue-700/60";
  if (element.type === "character") return "text-blue-900";
  if (element.type === "button") return "bg-violet text-white";
  if (element.type === "bottomNav") return "border border-line bg-white shadow-sm";
  if (element.type === "input") return "border border-slate-300 bg-white text-left";
  return "border border-line bg-[#f7f7fb] text-ink";
}

function ElementFallback({ element }: { element: IdmElement }) {
  if (element.type === "background") return null;
  if (element.type === "decoration") {
    return <Sparkles aria-hidden size={Math.min(48, Math.max(16, element.layout.width / 4))} className="pointer-events-none opacity-45" />;
  }
  if (element.type === "character") {
    return <span className="pointer-events-none flex size-full flex-col items-center justify-center gap-1 bg-white/15 px-2"><UserRound aria-hidden size={Math.min(64, Math.max(20, element.layout.width / 3))} className="opacity-55" /><span className="max-w-full truncate opacity-70">{element.name}</span></span>;
  }
  if (element.type === "illustration") {
    return <span className="pointer-events-none flex size-full flex-col items-center justify-center gap-1 bg-white/10 px-2"><Shapes aria-hidden size={Math.min(56, Math.max(20, element.layout.width / 4))} className="opacity-50" /><span className="max-w-full truncate opacity-70">{element.name}</span></span>;
  }
  if (element.type === "image" || element.type === "icon") {
    return <span className="pointer-events-none flex size-full flex-col items-center justify-center gap-1 bg-white/10 px-2"><ImageIcon aria-hidden size={Math.min(44, Math.max(16, element.layout.width / 4))} className="opacity-50" /><span className="max-w-full truncate opacity-70">{element.content.text || element.name}</span></span>;
  }
  return <span className="pointer-events-none truncate px-2">{element.content.text || element.name}</span>;
}

function isOutside(element: IdmElement, width: number, height: number) {
  if (element.type === "background" || element.type === "decoration" ||
    /shadow|glow|blur|декор|тень|свечение/i.test(`${element.semanticRole} ${element.content.assetRole || ""}`)) return false;
  return element.layout.x < 0 || element.layout.y < 0 ||
    element.layout.x + element.layout.width > width ||
    element.layout.y + element.layout.height > height;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ticks(size: number, step: number) {
  return Array.from({ length: Math.ceil(size / step) }, (_, index) => index * step);
}
