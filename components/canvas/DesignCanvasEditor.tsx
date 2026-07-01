"use client";

import { CheckCircle2, Code2, Grid3X3, Hand, Minus, Plus, Redo2, Save, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveCanvasIdmVersion } from "@/app/projects/[id]/screens/[screenId]/layout-actions";
import { ElementInspector } from "@/components/canvas/ElementInspector";
import { IdmCanvas } from "@/components/canvas/IdmCanvas";
import { LayersPanel } from "@/components/canvas/LayersPanel";
import { generateCssLayout } from "@/lib/design-code/css-layout-generator";
import { compileDesignModel } from "@/lib/idm/design-compiler";
import type { IdmElement, InternalDesignModel } from "@/lib/idm/types";

type Props = {
  projectId: string;
  screenId: string;
  versionId: string;
  versionNumber: number;
  initialIdm: InternalDesignModel;
  projectRules: Array<{ category: string; name: string; value: string }>;
  assets: Array<{ id: string; name: string; type: string; dataUrl: string | null; fileUrl: string | null; fileName: string | null; isPrimaryLogo: boolean }>;
};

export function DesignCanvasEditor({ projectId, screenId, versionId, versionNumber, initialIdm, projectRules, assets }: Props) {
  const router = useRouter();
  const [idm, setIdm] = useState(initialIdm);
  const [history, setHistory] = useState<InternalDesignModel[]>([]);
  const [future, setFuture] = useState<InternalDesignModel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(firstElementId(initialIdm));
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [panMode, setPanMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selected = idm.hierarchy.elements.find((element) => element.id === selectedId) ?? null;
  const elements = idm.hierarchy.elements.filter((element) => element.id !== idm.hierarchy.rootId);
  const compiled = useMemo(() => {
    try {
      return { value: compileDesignModel(idm, projectRules), error: "" };
    } catch (reason) {
      return { value: null, error: reason instanceof Error ? reason.message : "Не удалось пересобрать экран." };
    }
  }, [idm, projectRules]);
  const css = useMemo(() => generateCssLayout(idm), [idm]);
  const changed = JSON.stringify(idm) !== JSON.stringify(initialIdm);

  function commit(next: InternalDesignModel) {
    setHistory((items) => [...items.slice(-49), idm]);
    setFuture([]);
    setIdm(next);
    setMessage("");
    setError("");
  }

  function updateElement(next: IdmElement) {
    const oldId = idm.hierarchy.elements.some((element) => element.id === next.id) ? next.id : selectedId;
    const idChanged = oldId && oldId !== next.id;
    const idExists = idChanged && idm.hierarchy.elements.some((element) => element.id === next.id);
    if (idExists) {
      setError(`ID «${next.id}» уже используется.`);
      return;
    }
    commit({
      ...idm,
      hierarchy: {
        ...idm.hierarchy,
        elements: idm.hierarchy.elements.map((element) => {
          if (element.id === oldId) return next;
          if (!idChanged) return element;
          return {
            ...element,
            parent: element.parent === oldId ? next.id : element.parent,
            children: element.children.map((id) => id === oldId ? next.id : id),
          };
        }),
      },
      interactions: idChanged ? idm.interactions.map((item) => item.elementId === oldId ? { ...item, elementId: next.id } : item) : idm.interactions,
      dataBinding: idChanged ? idm.dataBinding.map((item) => item.elementId === oldId ? { ...item, elementId: next.id } : item) : idm.dataBinding,
    });
    if (idChanged) setSelectedId(next.id);
  }

  function updateById(id: string, updater: (element: IdmElement) => IdmElement) {
    const element = idm.hierarchy.elements.find((item) => item.id === id);
    if (element) {
      setSelectedId(id);
      updateElementWithId(id, updater(element));
    }
  }

  function updateElementWithId(id: string, next: IdmElement) {
    commit({ ...idm, hierarchy: { ...idm.hierarchy, elements: idm.hierarchy.elements.map((element) => element.id === id ? next : element) } });
  }

  function duplicate(id: string) {
    const source = idm.hierarchy.elements.find((element) => element.id === id);
    if (!source || source.layout.locked) return;
    const newId = uniqueId(idm, `${source.id}_copy`);
    const copy: IdmElement = {
      ...source,
      id: newId,
      name: `${source.name} — копия`,
      children: [],
      layout: { ...source.layout, x: source.layout.x + 12, y: source.layout.y + 12, locked: false, zIndex: maxZ(idm) + 1 },
      componentRef: source.componentRef ? { ...source.componentRef } : null,
      content: { ...source.content },
      style: { ...source.style },
      animation: { ...source.animation },
    };
    commit({
      ...idm,
      hierarchy: {
        ...idm.hierarchy,
        elements: [
          ...idm.hierarchy.elements.map((element) => element.id === source.parent ? { ...element, children: [...element.children, newId] } : element),
          copy,
        ],
      },
    });
    setSelectedId(newId);
  }

  function remove(id: string) {
    const element = idm.hierarchy.elements.find((item) => item.id === id);
    if (!element || element.layout.locked) return;
    if (!window.confirm(`Удалить элемент «${element.name}»? Он исчезнет только из новой версии.`)) return;
    const removedIds = collectDescendants(idm, id);
    commit({
      ...idm,
      hierarchy: {
        ...idm.hierarchy,
        elements: idm.hierarchy.elements
          .filter((item) => !removedIds.has(item.id))
          .map((item) => ({ ...item, children: item.children.filter((child) => !removedIds.has(child)) })),
      },
      interactions: idm.interactions.filter((item) => !removedIds.has(item.elementId)),
      dataBinding: idm.dataBinding.filter((item) => !removedIds.has(item.elementId)),
    });
    setSelectedId(null);
  }

  function reorder(id: string, direction: -1 | 1) {
    const ordered = elements.slice().sort((a, b) => (a.layout.zIndex ?? 0) - (b.layout.zIndex ?? 0));
    const currentIndex = ordered.findIndex((element) => element.id === id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
    const zById = new Map(ordered.map((element, index) => [element.id, index + 1]));
    commit({
      ...idm,
      hierarchy: {
        ...idm.hierarchy,
        elements: idm.hierarchy.elements.map((element) => zById.has(element.id)
          ? { ...element, layout: { ...element.layout, zIndex: zById.get(element.id)! } }
          : element),
      },
    });
  }

  function addElement() {
    const id = uniqueId(idm, "element");
    const element: IdmElement = {
      id,
      type: "section",
      name: "Новый элемент",
      parent: idm.hierarchy.rootId,
      children: [],
      layout: { x: 20, y: 120, width: 350, height: 56, radius: 12, zIndex: maxZ(idm) + 1, visible: true, locked: false },
      style: { background: "#F3F4F8", opacity: 1, color: "#111326" },
      animation: { type: "none", durationMs: 0, curve: "linear", delayMs: 0 },
      constraints: ["editor:rotation=0", "editor:fontSize=16", "editor:fontWeight=400", "editor:textAlign=left"],
      behavior: [],
      semanticRole: "group",
      content: { text: "Новый элемент" },
      componentRef: null,
      state: {},
    };
    commit({
      ...idm,
      hierarchy: {
        ...idm.hierarchy,
        elements: idm.hierarchy.elements
          .map((item) => item.id === idm.hierarchy.rootId ? { ...item, children: [...item.children, id] } : item)
          .concat(element),
      },
    });
    setSelectedId(id);
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [idm, ...items]);
    setHistory((items) => items.slice(0, -1));
    setIdm(previous);
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, idm]);
    setFuture((items) => items.slice(1));
    setIdm(next);
  }

  async function save() {
    if (!changed || !compiled.value) return;
    setSaving(true);
    setError("");
    const result = await saveCanvasIdmVersion(projectId, screenId, versionId, idm);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Новая версия ${result.versionNumber} создана. Все представления пересобраны из IDM.`);
    router.refresh();
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet">Визуальный редактор · версия {versionNumber}</p>
          <h2 className="mt-1 text-lg font-black">Canvas 390 × 844</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolButton label="Отменить" disabled={!history.length} onClick={undo}><Undo2 size={15} /></ToolButton>
          <ToolButton label="Повторить" disabled={!future.length} onClick={redo}><Redo2 size={15} /></ToolButton>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <ToolButton label="Уменьшить" onClick={() => setZoom((value) => Math.max(0.35, value - 0.1))}><ZoomOut size={15} /></ToolButton>
          <span className="min-w-14 text-center text-xs font-bold">{Math.round(zoom * 100)}%</span>
          <ToolButton label="Увеличить" onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}><ZoomIn size={15} /></ToolButton>
          <ToolButton label="Перемещение холста" active={panMode} onClick={() => setPanMode((value) => !value)}><Hand size={15} /></ToolButton>
          <ToolButton label="Сбросить панорамирование" onClick={() => setPan({ x: 0, y: 0 })}><Minus size={15} /></ToolButton>
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <ToolButton label="Добавить элемент" onClick={addElement}><Plus size={15} /></ToolButton>
          <button type="button" disabled={!changed || !compiled.value || saving} onClick={save} className="ml-1 inline-flex h-9 items-center gap-2 rounded-lg bg-violet px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Save size={14} /> {saving ? "Сохранение…" : "Сохранить новую версию"}</button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs">
        <Toggle label="Сетка" checked={showGrid} onChange={setShowGrid} icon={<Grid3X3 size={13} />} />
        <Toggle label="Привязка 4 px" checked={snap} onChange={setSnap} />
        <Toggle label="Safe Area" checked={showSafeArea} onChange={setShowSafeArea} />
        <Toggle label="Линейки" checked={showRulers} onChange={setShowRulers} />
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold ${compiled.value ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
          {compiled.value ? <CheckCircle2 size={13} /> : <Code2 size={13} />}
          {compiled.value ? "Всё синхронизировано" : "Требуется пересборка"}
        </span>
      </div>
      {message ? <p className="m-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
      {error || compiled.error ? <p className="m-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error || compiled.error}</p> : null}

      <div className="grid min-w-0 xl:grid-cols-[250px_minmax(560px,1fr)_300px]">
        <LayersPanel
          elements={elements}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRename={(id, name) => updateById(id, (element) => ({ ...element, name }))}
          onDuplicate={duplicate}
          onDelete={remove}
          onToggleLock={(id) => updateById(id, (element) => ({ ...element, layout: { ...element.layout, locked: !element.layout.locked } }))}
          onToggleVisible={(id) => updateById(id, (element) => ({ ...element, layout: { ...element.layout, visible: element.layout.visible === false } }))}
          onReorder={reorder}
          assets={assets}
        />
        <IdmCanvas
          idm={idm}
          selectedId={selectedId}
          zoom={zoom}
          pan={pan}
          snap={snap}
          showGrid={showGrid}
          showSafeArea={showSafeArea}
          showRulers={showRulers}
          panMode={panMode}
          onPanChange={setPan}
          onSelect={setSelectedId}
          onChange={updateElement}
          assets={assets}
        />
        <ElementInspector element={selected} onChange={updateElement} assets={assets} projectId={projectId} />
      </div>

      <details className="border-t border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-600">Производные представления (обновляются автоматически)</summary>
        {compiled.value ? (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            <Artifact title="Layout JSON" value={JSON.stringify(compiled.value.layoutJson, null, 2)} />
            <Artifact title="HTML" value={compiled.value.htmlLayout} />
            <Artifact title="CSS" value={css} />
            <Artifact title="Flutter Tree" value={compiled.value.flutterWidgetTree} />
            <Artifact title="Спецификация дизайна" value={compiled.value.designSpec} />
            <Artifact title="Промпт для изображения" value={compiled.value.imagePrompt} />
            <Artifact title="Animation Spec" value={compiled.value.animationSpec} />
          </div>
        ) : null}
      </details>
    </section>
  );
}

function ToolButton({ label, onClick, children, disabled = false, active = false }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`flex size-9 items-center justify-center rounded-lg border disabled:opacity-30 ${active ? "border-violet bg-violet text-white" : "border-slate-200 bg-white text-slate-600 hover:border-violet/40 hover:text-violet"}`}>{children}</button>;
}
function Toggle({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (value: boolean) => void; icon?: React.ReactNode }) {
  return <label className="flex cursor-pointer items-center gap-1.5 font-bold text-slate-600"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {icon}{label}</label>;
}
function Artifact({ title, value }: { title: string; value: string }) {
  return <details className="min-w-0 rounded-xl border border-slate-200"><summary className="cursor-pointer px-3 py-2 text-xs font-black">{title}</summary><pre className="max-h-72 overflow-auto border-t border-slate-100 bg-slate-950 p-3 text-[10px] leading-5 text-slate-100">{value}</pre></details>;
}
function firstElementId(idm: InternalDesignModel) {
  return idm.hierarchy.elements.find((element) => element.id !== idm.hierarchy.rootId)?.id ?? null;
}
function maxZ(idm: InternalDesignModel) {
  return Math.max(0, ...idm.hierarchy.elements.map((element) => element.layout.zIndex ?? 0));
}
function uniqueId(idm: InternalDesignModel, prefix: string) {
  const ids = new Set(idm.hierarchy.elements.map((element) => element.id));
  if (!ids.has(prefix)) return prefix;
  let index = 2;
  while (ids.has(`${prefix}_${index}`)) index++;
  return `${prefix}_${index}`;
}
function collectDescendants(idm: InternalDesignModel, id: string) {
  const result = new Set<string>([id]);
  const byId = new Map(idm.hierarchy.elements.map((element) => [element.id, element]));
  const queue = [id];
  while (queue.length) {
    const current = byId.get(queue.shift()!);
    for (const child of current?.children ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
}
