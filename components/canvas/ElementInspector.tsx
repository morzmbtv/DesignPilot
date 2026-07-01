"use client";

import { Download, EyeOff, ExternalLink, ImagePlus, Loader2, Lock, RefreshCw, Unlock, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { layoutElementTypes } from "@/lib/layout";
import type { IdmElement } from "@/lib/idm/types";
import { readEditorProperties, writeEditorProperties } from "@/lib/idm/editor-properties";
import { useInterfaceMode } from "@/components/interface-mode";

type AssetOption = { id: string; name: string; type: string; dataUrl: string | null; fileUrl: string | null; fileName: string | null; isPrimaryLogo: boolean };

type InspectorProps = {
  element: IdmElement | null;
  onChange: (element: IdmElement) => void;
  onRegenerateAsset: (element: IdmElement, description: string) => Promise<void>;
  onUploadAsset: (element: IdmElement, file: File) => Promise<void>;
  assetBusy: boolean;
  assets: AssetOption[];
  projectId: string;
};

export function ElementInspector({ element, onChange, onRegenerateAsset, onUploadAsset, assetBusy, assets, projectId }: InspectorProps) {
  const { mode } = useInterfaceMode();
  if (!element) return <aside className="border-l border-slate-200 bg-white p-5"><h3 className="font-black">Инспектор</h3><p className="mt-3 text-sm leading-6 text-slate-500">Выберите элемент на холсте или в панели слоёв.</p></aside>;
  if (mode === "simple") {
    return <DesignerInspector element={element} onChange={onChange} onRegenerateAsset={onRegenerateAsset} onUploadAsset={onUploadAsset} assetBusy={assetBusy} assets={assets} projectId={projectId} />;
  }
  const locked = Boolean(element.layout.locked);
  const editor = readEditorProperties(element);
  const patch = (value: Partial<IdmElement>) => onChange({ ...element, ...value });
  const patchLayout = (value: Partial<IdmElement["layout"]>) => patch({ layout: { ...element.layout, ...value } });
  const patchStyle = (value: Partial<IdmElement["style"]>) => patch({ style: { ...element.style, ...value } });
  const patchContent = (value: Partial<IdmElement["content"]>) => patch({ content: { ...element.content, ...value } });
  const patchComponent = (value: string) => patch({ componentRef: value ? { componentId: value, name: value, source: "approved_library" } : null });
  const patchEditor = (value: Parameters<typeof writeEditorProperties>[1]) => onChange(writeEditorProperties(element, value));
  const selectedAsset = element.content.assetRef ? assets.find((asset) => asset.id === element.content.assetRef) : null;

  return (
    <aside className="border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-3">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Инспектор</p>
        <p className="mt-1 truncate text-sm font-black">{element.name}</p>
      </div>
      <div className="max-h-[710px] space-y-5 overflow-y-auto p-4">
        {locked ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong className="flex items-center gap-2"><Lock size={14} /> Элемент заблокирован</strong><p className="mt-1">Его можно выбрать, но нельзя двигать или менять размер.</p><button type="button" onClick={() => patchLayout({ locked: false })} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-700 px-3 font-bold text-white"><Unlock size={13} /> Разблокировать</button></div> : <button type="button" onClick={() => patchLayout({ locked: true })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold"><Lock size={13} /> Заблокировать</button>}
        <CompositionSummary element={element} />

        <InspectorSection title="Основное">
          <TextField label="ID" value={element.id} disabled={locked} onChange={(id) => patch({ id })} />
          <TextField label="Название" value={element.name} disabled={locked} onChange={(name) => patch({ name })} />
          <SelectField label="Тип" value={element.type} disabled={locked} onChange={(type) => patch({ type: type as IdmElement["type"] })} />
          <TextField label="Текст" value={element.content.text || ""} disabled={locked} onChange={(text) => patchContent({ text })} wide />
          <TextField label="Изображение / URL" value={element.content.alt || ""} disabled={locked} onChange={(alt) => patchContent({ alt })} wide />
        </InspectorSection>

        <InspectorSection title="Положение и размер">
          <NumberField label="X" value={element.layout.x} disabled={locked} onChange={(x) => patchLayout({ x })} />
          <NumberField label="Y" value={element.layout.y} disabled={locked} onChange={(y) => patchLayout({ y })} />
          <NumberField label="Ширина" value={element.layout.width} min={4} disabled={locked} onChange={(width) => patchLayout({ width })} />
          <NumberField label="Высота" value={element.layout.height} min={4} disabled={locked} onChange={(height) => patchLayout({ height })} />
          <NumberField label="Поворот" value={editor.rotation} disabled={locked} onChange={(rotation) => patchEditor({ rotation })} />
          <NumberField label="Радиус" value={element.layout.radius ?? 0} min={0} disabled={locked} onChange={(radius) => patchLayout({ radius })} />
          <NumberField label="Z-index" value={element.layout.zIndex ?? 1} disabled={locked} onChange={(zIndex) => patchLayout({ zIndex })} />
          <ToggleField label="Видимый" checked={element.layout.visible !== false} disabled={locked} onChange={(visible) => patchLayout({ visible })} />
        </InspectorSection>

        <InspectorSection title="Оформление">
          <NumberField label="Прозрачность" value={element.style.opacity ?? 1} min={0} max={1} step={0.05} disabled={locked} onChange={(opacity) => patchStyle({ opacity })} />
          <TextField label="Фон" value={element.style.background || ""} disabled={locked} onChange={(background) => patchStyle({ background })} />
          <TextField label="Цвет текста" value={element.style.color || ""} disabled={locked} onChange={(color) => patchStyle({ color })} />
          <TextField label="Шрифт" value={editor.fontFamily} disabled={locked} onChange={(fontFamily) => patchEditor({ fontFamily })} />
          <NumberField label="Размер шрифта" value={editor.fontSize ?? 16} min={1} disabled={locked} onChange={(fontSize) => patchEditor({ fontSize })} />
          <NumberField label="Насыщенность" value={editor.fontWeight ?? 400} min={100} step={100} disabled={locked} onChange={(fontWeight) => patchEditor({ fontWeight })} />
          <label className="text-[11px] font-bold text-slate-500">Выравнивание<select disabled={locked} value={editor.textAlign} onChange={(event) => patchEditor({ textAlign: event.target.value as "left" | "center" | "right" })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-100"><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
        </InspectorSection>

        <InspectorSection title="Связи">
          <TextField label="Component Ref" value={element.componentRef?.componentId || ""} disabled={locked} onChange={patchComponent} wide />
          <TextField label="Asset Ref" value={element.content.assetRef || ""} disabled={locked} onChange={(assetRef) => patchContent({ assetRef })} wide />
          <label className="col-span-2 text-[11px] font-bold text-slate-500">Заменить ассет<select disabled={locked} value={element.content.assetRef || ""} onChange={(event) => {
            const asset = assets.find((item) => item.id === event.target.value);
            patchContent({ assetRef: event.target.value || undefined, assetRole: asset?.isPrimaryLogo ? "primaryLogo" : asset?.type });
          }} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-100"><option value="">Без ассета</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}{asset.isPrimaryLogo ? " · основной логотип" : ""}</option>)}</select></label>
        </InspectorSection>
        {selectedAsset ? <section className="rounded-xl border border-violet/15 bg-violet/[0.035] p-3"><div className="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-white">{selectedAsset.dataUrl || selectedAsset.fileUrl ? <img src={selectedAsset.dataUrl || selectedAsset.fileUrl || ""} alt={selectedAsset.name} className="size-full object-contain" /> : null}</div><p className="mt-2 text-xs font-black">{selectedAsset.name}</p><div className="mt-2 flex flex-wrap gap-2"><Link href={`/projects/${projectId}/assets`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 text-[10px] font-bold"><ExternalLink size={12} /> Открыть в ассетах</Link>{selectedAsset.dataUrl || selectedAsset.fileUrl ? <a href={selectedAsset.dataUrl || selectedAsset.fileUrl || ""} download={selectedAsset.fileName || selectedAsset.name} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 text-[10px] font-bold"><Download size={12} /> Скачать</a> : null}</div><ElementCodeActions element={element} /></section> : null}
      </div>
    </aside>
  );
}

function DesignerInspector({
  element, onChange, onRegenerateAsset, onUploadAsset, assetBusy, assets, projectId,
}: Omit<InspectorProps, "element"> & { element: IdmElement }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState(element.content.alt || element.content.text || element.name);
  useEffect(() => {
    setDescription(element.content.alt || element.content.text || element.name);
  }, [element.id, element.content.alt, element.content.text, element.name]);

  const locked = Boolean(element.layout.locked);
  const editor = readEditorProperties(element);
  const selectedAsset = element.content.assetRef ? assets.find((asset) => asset.id === element.content.assetRef) : null;
  const visual = isVisualElement(element);
  const logo = isLogoElement(element);
  const patch = (value: Partial<IdmElement>) => onChange({ ...element, ...value });
  const patchLayout = (value: Partial<IdmElement["layout"]>) => patch({ layout: { ...element.layout, ...value } });
  const patchStyle = (value: Partial<IdmElement["style"]>) => patch({ style: { ...element.style, ...value } });
  const patchContent = (value: Partial<IdmElement["content"]>) => patch({ content: { ...element.content, ...value } });
  const patchEditor = (value: Parameters<typeof writeEditorProperties>[1]) => onChange(writeEditorProperties(element, value));

  async function upload(file: File | undefined) {
    if (!file) return;
    await onUploadAsset(element, file);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <aside className="border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet">Свойства элемента</p>
        <p className="mt-1 truncate text-sm font-black">{element.name}</p>
      </div>
      <div className="max-h-[710px] space-y-5 overflow-y-auto p-4">
        {locked ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <strong className="flex items-center gap-2"><Lock size={14} /> Элемент заблокирован</strong>
            <p className="mt-1">Разблокируйте его, чтобы изменить свойства или изображение.</p>
            <button type="button" onClick={() => patchLayout({ locked: false })} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-700 px-3 font-bold text-white"><Unlock size={13} /> Разблокировать</button>
          </div>
        ) : (
          <button type="button" onClick={() => patchLayout({ locked: true })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold"><Lock size={13} /> Заблокировать</button>
        )}
        <CompositionSummary element={element} />

        {visual ? (
          <>
            <AssetPreview element={element} asset={selectedAsset} />
            <InspectorSection title={element.type === "background" ? "Фон" : "Изображение"}>
              <TextField label="Название" value={element.name} disabled={locked} onChange={(name) => patch({ name })} wide />
              <TextField label="Asset Ref" value={element.content.assetRef || "Не создан"} disabled wide onChange={() => undefined} />
              <label className="col-span-2 text-[11px] font-bold text-slate-500">
                Заменить ассет
                <select
                  disabled={locked}
                  value={element.content.assetRef || ""}
                  onChange={(event) => {
                    const asset = assets.find((item) => item.id === event.target.value);
                    patchContent({ assetRef: asset?.id, assetRole: asset?.isPrimaryLogo ? "primaryLogo" : asset?.type });
                  }}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-100"
                >
                  <option value="">Без ассета</option>
                  {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}{asset.isPrimaryLogo ? " · основной логотип" : ""}</option>)}
                </select>
              </label>
              {element.type === "background" ? <TextField label="Цвет или градиент fallback" value={element.style.background || ""} disabled={locked} onChange={(background) => patchStyle({ background })} wide /> : null}
            </InspectorSection>

            {!logo ? (
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-3" open={!selectedAsset}>
                <summary className="cursor-pointer text-xs font-black">Изменить описание</summary>
                <textarea value={description} disabled={locked} onChange={(event) => {
                  setDescription(event.target.value);
                  patchContent({ alt: event.target.value });
                }} rows={4} className="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 disabled:bg-slate-100" />
              </details>
            ) : <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">Логотип не перерисовывается AI. Выберите или загрузите готовый брендовый ассет.</p>}

            <div className="grid gap-2">
              {!logo ? <button type="button" disabled={locked || assetBusy} onClick={() => onRegenerateAsset(element, description)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet px-3 text-xs font-black text-white disabled:opacity-40">{assetBusy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {element.type === "background" ? "Перегенерировать фон" : "Перегенерировать"}</button> : null}
              <button type="button" disabled={locked || assetBusy} onClick={() => fileInput.current?.click()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black disabled:opacity-40"><Upload size={14} /> {element.type === "background" ? "Загрузить свой фон" : "Загрузить своё"}</button>
              <input ref={fileInput} type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
              {element.type === "background" ? <button type="button" disabled={locked} onClick={() => patchLayout({ visible: false })} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black disabled:opacity-40"><EyeOff size={14} /> Скрыть фон</button> : null}
              {selectedAsset?.dataUrl || selectedAsset?.fileUrl ? <a href={selectedAsset.dataUrl || selectedAsset.fileUrl || ""} download={selectedAsset.fileName || selectedAsset.name} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black"><Download size={14} /> Скачать</a> : null}
              <Link href={`/projects/${projectId}/assets`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black"><ImagePlus size={14} /> Открыть библиотеку ассетов</Link>
            </div>
          </>
        ) : element.type === "text" ? (
          <>
            <InspectorSection title="Текст">
              <TextField label="Текст" value={element.content.text || ""} disabled={locked} onChange={(text) => patchContent({ text })} wide />
              <NumberField label="Размер" value={editor.fontSize ?? 16} min={1} disabled={locked} onChange={(fontSize) => patchEditor({ fontSize })} />
              <NumberField label="Насыщенность" value={editor.fontWeight ?? 400} min={100} step={100} disabled={locked} onChange={(fontWeight) => patchEditor({ fontWeight })} />
              <TextField label="Цвет" value={element.style.color || ""} disabled={locked} onChange={(color) => patchStyle({ color })} />
              <label className="text-[11px] font-bold text-slate-500">Выравнивание<select disabled={locked} value={editor.textAlign} onChange={(event) => patchEditor({ textAlign: event.target.value as "left" | "center" | "right" })} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-100"><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
            </InspectorSection>
            <PositionFields element={element} locked={locked} patchLayout={patchLayout} />
          </>
        ) : element.type === "progress" ? (
          <>
            <InspectorSection title="Индикатор прогресса">
              <NumberField label="Ширина" value={element.layout.width} min={4} disabled={locked} onChange={(width) => patchLayout({ width })} />
              <NumberField label="Высота" value={element.layout.height} min={4} disabled={locked} onChange={(height) => patchLayout({ height })} />
              <TextField label="Фон" value={element.style.background || ""} disabled={locked} onChange={(background) => patchStyle({ background })} wide />
              <TextField label="Цвет заполнения" value={element.style.color || ""} disabled={locked} onChange={(color) => patchStyle({ color })} />
              <NumberField label="Радиус" value={element.layout.radius ?? 0} min={0} disabled={locked} onChange={(radius) => patchLayout({ radius })} />
              <TextField label="Значение" value={element.content.text || ""} disabled={locked} onChange={(text) => patchContent({ text })} />
            </InspectorSection>
            <PositionFields element={element} locked={locked} patchLayout={patchLayout} />
          </>
        ) : (
          <>
            <InspectorSection title="Основное">
              <TextField label="Название" value={element.name} disabled={locked} onChange={(name) => patch({ name })} wide />
              <TextField label="Текст" value={element.content.text || ""} disabled={locked} onChange={(text) => patchContent({ text })} wide />
              <TextField label="Фон" value={element.style.background || ""} disabled={locked} onChange={(background) => patchStyle({ background })} wide />
              <NumberField label="Радиус" value={element.layout.radius ?? 0} min={0} disabled={locked} onChange={(radius) => patchLayout({ radius })} />
              <NumberField label="Прозрачность" value={element.style.opacity ?? 1} min={0} max={1} step={0.05} disabled={locked} onChange={(opacity) => patchStyle({ opacity })} />
            </InspectorSection>
            <PositionFields element={element} locked={locked} patchLayout={patchLayout} />
          </>
        )}
      </div>
    </aside>
  );
}

function AssetPreview({ element, asset }: { element: IdmElement; asset: AssetOption | null | undefined }) {
  const source = asset?.dataUrl || asset?.fileUrl;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-[linear-gradient(45deg,#f1f2f6_25%,transparent_25%),linear-gradient(-45deg,#f1f2f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f2f6_75%),linear-gradient(-45deg,transparent_75%,#f1f2f6_75%)] bg-[length:16px_16px]">
      <div className="flex h-40 items-center justify-center" style={{ background: source ? undefined : element.style.background }}>
        {source ? <img src={source} alt={element.content.alt || asset?.name || element.name} className={`size-full ${element.type === "background" ? "object-cover" : "object-contain"}`} /> : <span className="px-4 text-center text-xs font-bold text-slate-500">Изображение ещё не создано. Используется визуальный fallback.</span>}
      </div>
      <p className="border-t border-slate-200 bg-white px-3 py-2 text-xs font-black">{asset?.name || element.name}</p>
    </div>
  );
}

function PositionFields({ element, locked, patchLayout }: {
  element: IdmElement;
  locked: boolean;
  patchLayout: (value: Partial<IdmElement["layout"]>) => void;
}) {
  return <InspectorSection title="Положение и размер">
    <NumberField label="X" value={element.layout.x} disabled={locked} onChange={(x) => patchLayout({ x })} />
    <NumberField label="Y" value={element.layout.y} disabled={locked} onChange={(y) => patchLayout({ y })} />
    <NumberField label="Ширина" value={element.layout.width} min={4} disabled={locked} onChange={(width) => patchLayout({ width })} />
    <NumberField label="Высота" value={element.layout.height} min={4} disabled={locked} onChange={(height) => patchLayout({ height })} />
  </InspectorSection>;
}

function CompositionSummary({ element }: { element: IdmElement }) {
  if (!element.composition) return null;
  const rows = [
    ["Anchor", element.composition.anchor],
    ["Role", element.composition.role],
    ["Size", element.composition.size],
    ["Width ratio", element.composition.widthRatio],
    ["Height ratio", element.composition.heightRatio],
    ["Offsets", formatOffsets(element.composition)],
    ["Overflow", element.composition.allowOverflow],
    ["Priority", element.composition.priority],
    ["Layout source", element.layout.manualOverride ? "manual override" : element.layout.source || "engine"],
  ].filter((row) => row[1] !== undefined && row[1] !== "");
  return <details className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
    <summary className="cursor-pointer text-xs font-black text-blue-900">Composition</summary>
    <dl className="mt-3 grid grid-cols-[100px_1fr] gap-x-2 gap-y-1 text-[11px]">
      {rows.map(([label, value]) => <div key={String(label)} className="contents"><dt className="font-bold text-blue-700">{label}</dt><dd className="break-all text-blue-950">{String(value)}</dd></div>)}
    </dl>
  </details>;
}

function formatOffsets(composition: NonNullable<IdmElement["composition"]>) {
  return [
    composition.topOffset !== undefined ? `top ${composition.topOffset}` : "",
    composition.rightOffset !== undefined ? `right ${composition.rightOffset}` : "",
    composition.bottomOffset !== undefined ? `bottom ${composition.bottomOffset}` : "",
    composition.leftOffset !== undefined ? `left ${composition.leftOffset}` : "",
  ].filter(Boolean).join(", ");
}

function isVisualElement(element: IdmElement) {
  return ["background", "illustration", "character", "decoration", "icon", "image", "avatar"].includes(element.type);
}

function isLogoElement(element: IdmElement) {
  return element.semanticRole === "logo" || element.content.assetRole === "primaryLogo" || /logo|логотип/i.test(`${element.id} ${element.name}`);
}

function ElementCodeActions({ element }: { element: IdmElement }) {
  const html = `<${element.type === "icon" ? "Icon" : "Image"} id="${element.id}" assetRef="${element.content.assetRef || ""}" x="${element.layout.x}" y="${element.layout.y}" width="${element.layout.width}" height="${element.layout.height}" />`;
  const css = `#${element.id} { position: absolute; left: ${element.layout.x}px; top: ${element.layout.y}px; width: ${element.layout.width}px; height: ${element.layout.height}px; }`;
  return <div className="mt-2 flex gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(html)} className="text-[10px] font-bold text-violet">Скопировать HTML</button><button type="button" onClick={() => navigator.clipboard.writeText(css)} className="text-[10px] font-bold text-violet">Скопировать CSS</button></div>;
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h4 className="mb-3 border-b border-slate-100 pb-2 text-xs font-black text-slate-700">{title}</h4><div className="grid grid-cols-2 gap-2">{children}</div></section>;
}
function TextField({ label, value, onChange, disabled = false, wide = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; wide?: boolean }) {
  return <label className={`text-[11px] font-bold text-slate-500 ${wide ? "col-span-2" : ""}`}>{label}<input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-100" /></label>;
}
function NumberField({ label, value, onChange, disabled = false, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min?: number; max?: number; step?: number }) {
  return <label className="text-[11px] font-bold text-slate-500">{label}<input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-100" /></label>;
}
function SelectField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="text-[11px] font-bold text-slate-500">{label}<select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:bg-slate-100">{layoutElementTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>;
}
function ToggleField({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-slate-200 px-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /> {label}</label>;
}
