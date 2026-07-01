"use client";

import { ChevronDown, ChevronUp, CopyPlus, Eye, EyeOff, GripVertical, Lock, Trash2, Unlock } from "lucide-react";
import type { IdmElement } from "@/lib/idm/types";

type Props = {
  elements: IdmElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  assets: Array<{ id: string; name: string; dataUrl: string | null; fileUrl: string | null }>;
};

export function LayersPanel({ elements, selectedId, onSelect, onRename, onDuplicate, onDelete, onToggleLock, onToggleVisible, onReorder, assets }: Props) {
  const ordered = elements.slice().sort((a, b) => (b.layout.zIndex ?? 0) - (a.layout.zIndex ?? 0));
  return (
    <aside className="min-w-0 border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Слои</p>
        <p className="mt-1 text-xs text-slate-400">{ordered.length} элементов</p>
      </div>
      <div className="max-h-[710px] overflow-y-auto p-2">
        {ordered.length ? ordered.map((element, index) => (
          <div
            key={element.id}
            data-testid={`layer-${element.id}`}
            className={`group mb-1 rounded-lg border px-2 py-2 ${selectedId === element.id ? "border-blue-300 bg-blue-50" : "border-transparent hover:bg-slate-50"}`}
          >
            <button type="button" onClick={() => onSelect(element.id)} className="flex w-full min-w-0 items-center gap-2 text-left">
              <GripVertical size={14} className="shrink-0 text-slate-300" />
              <LayerPreview element={element} assets={assets} />
              <span className="min-w-0 flex-1">
                <input
                  aria-label={`Название слоя ${element.id}`}
                  value={element.name}
                  disabled={element.layout.locked}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onRename(element.id, event.target.value)}
                  className="w-full border-0 bg-transparent p-0 text-xs font-bold outline-none"
                />
                <span className="block truncate text-[10px] text-slate-400">{element.type} · z {element.layout.zIndex ?? 0}</span>
              </span>
              {element.layout.visible === false ? <EyeOff size={13} className="text-slate-400" /> : <Eye size={13} className="text-slate-400" />}
              {element.layout.locked ? <Lock size={12} className="text-amber-600" /> : null}
            </button>
            {selectedId === element.id ? (
              <div className="mt-2 flex items-center justify-end gap-1 border-t border-blue-100 pt-2">
                <LayerButton label={element.layout.visible === false ? "Показать" : "Скрыть"} disabled={Boolean(element.layout.locked)} onClick={() => onToggleVisible(element.id)}>{element.layout.visible === false ? <Eye size={13} /> : <EyeOff size={13} />}</LayerButton>
                <LayerButton label={element.layout.locked ? "Разблокировать" : "Заблокировать"} onClick={() => onToggleLock(element.id)}>{element.layout.locked ? <Unlock size={13} /> : <Lock size={13} />}</LayerButton>
                <LayerButton label="Выше" disabled={Boolean(element.layout.locked) || index === 0} onClick={() => onReorder(element.id, 1)}><ChevronUp size={13} /></LayerButton>
                <LayerButton label="Ниже" disabled={Boolean(element.layout.locked) || index === ordered.length - 1} onClick={() => onReorder(element.id, -1)}><ChevronDown size={13} /></LayerButton>
                <LayerButton label="Дублировать" disabled={Boolean(element.layout.locked)} onClick={() => onDuplicate(element.id)}><CopyPlus size={13} /></LayerButton>
                <LayerButton label="Удалить" disabled={Boolean(element.layout.locked)} onClick={() => onDelete(element.id)} danger><Trash2 size={13} /></LayerButton>
              </div>
            ) : null}
          </div>
        )) : <p className="p-5 text-center text-xs text-slate-400">На экране пока нет слоёв.</p>}
      </div>
    </aside>
  );
}

function LayerPreview({ element, assets }: { element: IdmElement; assets: Props["assets"] }) {
  const asset = element.content.assetRef ? assets.find((item) => item.id === element.content.assetRef) : null;
  const source = asset?.dataUrl || asset?.fileUrl;
  return source
    ? <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100"><img src={source} alt="" className="size-full object-contain" /></span>
    : <span className="flex size-6 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-black text-slate-500">{element.type.slice(0, 2).toUpperCase()}</span>;
}

function LayerButton({ label, onClick, children, disabled = false, danger = false }: {
  label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean;
}) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`flex size-7 items-center justify-center rounded-md border bg-white disabled:opacity-30 ${danger ? "border-red-100 text-red-600" : "border-slate-200 text-slate-600 hover:text-blue-600"}`}>{children}</button>;
}
