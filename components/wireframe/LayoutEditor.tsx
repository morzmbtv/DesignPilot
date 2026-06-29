"use client";

import { Check, Copy, CopyPlus, Lock, RotateCcw, Save, Trash2, TriangleAlert, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { generateFallbackLayout, saveDesignCodeVersion, saveManualLayoutVersion } from "@/app/projects/[id]/screens/[screenId]/layout-actions";
import { createBlankLayout, layoutElementTypes, parseLayoutJson, validateLayoutJson, type LayoutElement, type LayoutJson } from "@/lib/layout";
import { generateHtmlLayout } from "@/lib/design-code/html-layout-generator";
import { generateFlutterWidgetTree } from "@/lib/design-code/flutter-tree-generator";
import { WireframePreview } from "./WireframePreview";
import { useInterfaceMode } from "@/components/interface-mode";

export function LayoutEditor({ projectId, screenId, screenName, version }: {
  projectId: string; screenId: string; screenName: string;
  version: { id: string; versionNumber: number; layoutJson: string | null; designSpec: string; imagePrompt: string; htmlLayout: string | null; flutterWidgetTree: string | null };
}) {
  const router = useRouter();
  const { mode } = useInterfaceMode();
  const originalResult = useMemo(() => parseLayoutJson(version.layoutJson), [version.layoutJson]);
  const original = originalResult.layout;
  const [layout, setLayout] = useState<LayoutJson | null>(original);
  const [selectedId, setSelectedId] = useState<string | null>(original?.elements[0]?.id ?? null);
  const [tab, setTab] = useState<"preview" | "spec" | "json" | "html" | "flutter" | "prompt">("preview");
  const [jsonText, setJsonText] = useState(version.layoutJson ? pretty(version.layoutJson) : "");
  const [errors, setErrors] = useState<string[]>([]);
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(true);
  const [message, setMessage] = useState("");
  const [editingHtml, setEditingHtml] = useState(false);
  const generatedHtml = useMemo(() => layout ? generateHtmlLayout(layout, version.designSpec, []) : "", [layout, version.designSpec]);
  const generatedFlutter = useMemo(() => layout ? generateFlutterWidgetTree(layout, version.designSpec, []) : "", [layout, version.designSpec]);
  const [htmlDraft, setHtmlDraft] = useState(version.htmlLayout || generatedHtml);
  const selected = layout?.elements.find((element) => element.id === selectedId) ?? null;
  const setNextLayout = (next: LayoutJson) => { setLayout(next); setJsonText(JSON.stringify(next, null, 2)); setErrors([]); };
  const updateElement = (next: LayoutElement) => layout && setNextLayout({ ...layout, elements: layout.elements.map((element) => element.id === selectedId ? next : element) });
  function addElement(type: LayoutElement["type"] = "text") {
    const ids = new Set(layout?.elements.map((element) => element.id) ?? []);
    let index = 1; while (ids.has(`${type}_${index}`)) index++;
    const element: LayoutElement = { id: `${type}_${index}`, type, label: "Новый элемент", x: 20, y: 120, width: 350, height: 56, align: "left", style: "body", radius: type === "avatar" ? 999 : 12, background: type === "text" ? "transparent" : "#F3F3F8", opacity: 1, zIndex: 1, locked: false };
    const next = layout ?? { viewport: { width: 390, height: 844 }, elements: [] };
    setNextLayout({ ...next, elements: [...next.elements, element] }); setSelectedId(element.id);
  }
  function duplicate() {
    if (!layout || !selected || selected.locked) return;
    let id = `${selected.id}_copy`; let i = 2; while (layout.elements.some((element) => element.id === id)) id = `${selected.id}_copy${i++}`;
    const copy = { ...selected, id, x: selected.x + 12, y: selected.y + 12 };
    setNextLayout({ ...layout, elements: [...layout.elements, copy] }); setSelectedId(id);
  }
  function remove() { if (layout && selected && !selected.locked) { setNextLayout({ ...layout, elements: layout.elements.filter((element) => element.id !== selected.id) }); setSelectedId(null); } }
  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      const result = validateLayoutJson(parsed);
      if (result.layout && layout) {
        const protectedIds = lockedElementChanges(layout, result.layout);
        if (protectedIds.length) return setErrors([`Заблокированные элементы нельзя изменить через JSON: ${protectedIds.join(", ")}. Сначала разблокируйте их в инспекторе.`]);
      }
      setErrors(result.errors);
      if (result.layout) { setLayout(result.layout); setSelectedId(result.layout.elements[0]?.id ?? null); setMessage("JSON применён к предпросмотру"); }
    }
    catch { setErrors(["Некорректный синтаксис JSON"]); }
  }
  async function save() {
    if (!layout) return;
    const result = await saveManualLayoutVersion(projectId, screenId, version.id, layout);
    if (result.ok) { setMessage(`Сохранено как версия ${result.versionNumber}`); router.refresh(); } else setErrors([result.error]);
  }
  async function fallback() {
    const result = await generateFallbackLayout(projectId, screenId, version.id);
    if (result.ok) { setMessage(`Базовый layout сохранён как версия ${result.versionNumber}`); router.refresh(); } else setErrors([result.error]);
  }
  async function refreshCode() {
    if (!layout) return setErrors(["Layout JSON отсутствует."]);
    const result = await saveDesignCodeVersion(projectId, screenId, version.id, undefined, layout);
    if (result.ok) { setMessage(`Код экрана сохранён как версия ${result.versionNumber}`); router.refresh(); } else setErrors([result.error]);
  }
  async function saveHtml() {
    const result = await saveDesignCodeVersion(projectId, screenId, version.id, htmlDraft);
    if (result.ok) { setMessage(`HTML Layout сохранён как версия ${result.versionNumber}`); setEditingHtml(false); router.refresh(); } else setErrors([result.error]);
  }
  async function copy(value: string, label: string) { await navigator.clipboard.writeText(value); setMessage(`${label}: скопировано`); }
  const layoutChanged = Boolean(layout && original && JSON.stringify(layout) !== JSON.stringify(original));
  const updatedPrompt = layout ? `${version.imagePrompt}\n\nSTRICT LAYOUT OVERRIDES:\n${layout.elements.map((element) => `- element [${element.id}] “${element.label}”: x=${element.x}, y=${element.y}, width=${element.width}, height=${element.height}, locked=${Boolean(element.locked)}`).join("\n")}\nPreserve all other layout, colors, typography, spacing, and elements unchanged.` : version.imagePrompt;
  const promptSynchronized = !layoutChanged || updatedPrompt !== version.imagePrompt;

  useEffect(() => {
    setLayout(original);
    setJsonText(version.layoutJson ? pretty(version.layoutJson) : "");
    setSelectedId(original?.elements[0]?.id ?? null);
    setErrors([]);
    setHtmlDraft(version.htmlLayout || (original ? generateHtmlLayout(original, version.designSpec, []) : ""));
    setEditingHtml(false);
  }, [original, version.designSpec, version.htmlLayout, version.id, version.layoutJson]);

  useEffect(() => {
    if (mode === "simple") setTab("preview");
  }, [mode]);

  if (!layout) return (
    <section className="mt-8 rounded-[22px] border border-dashed border-line bg-white p-8 text-center">
      <TriangleAlert className="mx-auto text-amber-500" />
      <h2 className="mt-4 text-xl font-black">{version.layoutJson ? "Layout JSON невалиден, HTML/Flutter не может быть создан." : "Layout JSON отсутствует."}</h2>
      <p className="mt-2 text-sm text-muted">{version.layoutJson ? originalResult.errors.join("; ") : "HTML Layout и Flutter Tree пока недоступны. Сначала создайте Layout JSON."}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button onClick={() => setNextLayout(createBlankLayout(screenName))} className="h-11 rounded-xl bg-violet px-5 text-sm font-bold text-white">Создать пустой layout</button>
        <button onClick={fallback} className="h-11 rounded-xl border border-line px-5 text-sm font-bold">Создать layout из спецификации</button>
      </div>
    </section>
  );

  return (
    <section className="mt-8 overflow-hidden rounded-[22px] border border-line bg-white">
      <div className="flex flex-col gap-4 border-b border-line p-5 xl:flex-row xl:items-center xl:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.1em] text-violet">Версия {version.versionNumber}</p><h2 className="mt-1 text-xl font-black">{mode === "simple" ? "Схема экрана" : "Код и схема экрана"}</h2></div>
        {mode === "expert" ? <div className="flex flex-wrap gap-2">
          {([
            ["preview", "Предварительная схема"], ["spec", "Спецификация дизайна"], ["json", "Layout JSON"],
            ["html", "HTML Layout"], ["flutter", "Дерево Flutter"], ["prompt", "Промпт для изображения"],
          ] as const).map(([item, label]) => <button key={item} onClick={() => setTab(item)} className={`h-9 rounded-xl px-3 text-sm font-bold ${tab === item ? "bg-violet text-white" : "bg-[#f4f4f8] text-muted"}`}>{label}</button>)}
        </div> : null}
      </div>
      {message ? <p className="mx-5 mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}
      {errors.length ? <div className="mx-5 mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
      {tab === "preview" ? (
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(320px,1fr)_360px]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <label><input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} /> Привязка к сетке</label>
              <label><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} /> Показывать сетку</label>
              <select aria-label="Тип нового элемента" className="h-9 rounded-xl border border-line px-3" onChange={(event) => { if (event.target.value) addElement(event.target.value as LayoutElement["type"]); event.target.value = ""; }} defaultValue=""><option value="" disabled>Добавить элемент…</option>{layoutElementTypes.map((type) => <option key={type} value={type}>{elementTypeLabels[type]}</option>)}</select>
            </div>
            <WireframePreview layout={layout} selectedId={selectedId} onSelect={(id) => setSelectedId(id || null)} onChange={updateElement} snap={snap} showGrid={grid} />
          </div>
          <aside className="h-fit rounded-2xl border border-line bg-[#fafaff] p-5 lg:sticky lg:top-5">
            <h3 className="font-black">Инспектор элемента</h3>
            {selected ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {selected.locked ? <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="flex items-center gap-2 text-sm font-black text-amber-800"><Lock size={16} /> Элемент заблокирован</p><p className="mt-2 text-xs leading-5 text-amber-800/80">Заблокированные элементы защищены от случайных изменений, но вы можете разблокировать их вручную.</p><button onClick={() => updateElement({ ...selected, locked: false })} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-amber-700 px-3 text-xs font-bold text-white"><Unlock size={14} /> Разблокировать</button></div> : <button onClick={() => updateElement({ ...selected, locked: true })} className="editor-action sm:col-span-2 justify-self-start"><Lock size={15} /> Заблокировать</button>}
              {mode === "expert" ? <Field label="ID" value={selected.id} onChange={(value) => updateElement({ ...selected, id: value })} disabled={selected.locked} /> : <Field label="Название" value={selected.id} onChange={(value) => updateElement({ ...selected, id: value })} disabled={selected.locked} />}
              <label className="text-xs font-bold text-muted">Тип<select disabled={selected.locked} value={selected.type} onChange={(event) => updateElement({ ...selected, type: event.target.value as LayoutElement["type"] })} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 disabled:cursor-not-allowed disabled:bg-[#ededf2]">{layoutElementTypes.map((type) => <option key={type} value={type}>{elementTypeLabels[type]}</option>)}</select></label>
              <Field label="Текст" value={selected.label} onChange={(value) => updateElement({ ...selected, label: value })} wide disabled={selected.locked} />
              {([["x", "X"], ["y", "Y"], ["width", "Ширина"], ["height", "Высота"], ["radius", "Радиус"]] as const).map(([key, label]) => <NumberField key={key} label={label} value={selected[key] ?? 0} onChange={(value) => updateElement({ ...selected, [key]: value })} disabled={selected.locked} />)}
              {mode === "expert" ? <><NumberField label="Прозрачность" value={selected.opacity ?? 1} onChange={(value) => updateElement({ ...selected, opacity: value })} disabled={selected.locked} /><NumberField label="Слой" value={selected.zIndex ?? 0} onChange={(value) => updateElement({ ...selected, zIndex: value })} disabled={selected.locked} /><Field label="Выравнивание" value={selected.align ?? ""} onChange={(value) => updateElement({ ...selected, align: value })} disabled={selected.locked} /><Field label="Стиль" value={selected.style ?? ""} onChange={(value) => updateElement({ ...selected, style: value })} disabled={selected.locked} /></> : null}
              <Field label="Цвет" value={selected.background ?? ""} onChange={(value) => updateElement({ ...selected, background: value })} wide disabled={selected.locked} />
              <div className="flex gap-2 sm:col-span-2"><button disabled={selected.locked} onClick={duplicate} className="editor-action disabled:cursor-not-allowed disabled:opacity-40"><CopyPlus size={15} /> Дублировать</button><button disabled={selected.locked} onClick={remove} className="editor-action text-red-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={15} /> Удалить</button></div>
            </div> : <p className="mt-4 text-sm text-muted">Выберите элемент на схеме.</p>}
          </aside>
        </div>
      ) : null}
      {tab === "json" ? <div className="p-5"><textarea aria-label="Layout JSON" value={jsonText} onChange={(event) => setJsonText(event.target.value)} rows={28} className="w-full rounded-2xl border border-line bg-[#101223] p-4 font-mono text-xs leading-5 text-white" /><div className="mt-3 flex gap-2"><button onClick={applyJson} className="editor-action"><Check size={15} /> Применить JSON</button><button onClick={() => { try { setErrors(validateLayoutJson(JSON.parse(jsonText)).errors); } catch { setErrors(["Некорректный синтаксис JSON"]); } }} className="editor-action">Проверить</button><button onClick={() => copy(jsonText, "Layout JSON")} className="editor-action"><Copy size={15} /> Копировать</button></div></div> : null}
      {tab === "html" ? <CodePanel title="HTML Layout" value={htmlDraft || generatedHtml} editing={editingHtml} onChange={setHtmlDraft} onCopy={() => copy(htmlDraft || generatedHtml, "HTML Layout")} onRefresh={refreshCode} onEdit={() => setEditingHtml(true)} onSave={saveHtml} applyLabel="Применить HTML к Layout JSON — будет добавлено позже" /> : null}
      {tab === "flutter" ? <CodePanel title="Flutter Tree" value={version.flutterWidgetTree || generatedFlutter} onCopy={() => copy(version.flutterWidgetTree || generatedFlutter, "Flutter Tree")} onRefresh={refreshCode} /> : null}
      {tab === "prompt" ? <TextPanel value={updatedPrompt} onCopy={() => copy(updatedPrompt, "Промпт для изображения")} /> : null}
      {tab === "spec" ? <TextPanel value={version.designSpec} onCopy={() => copy(version.designSpec, "Спецификация дизайна")} /> : null}
      <div className="flex flex-wrap gap-2 border-t border-line p-5">
        <button onClick={save} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white"><Save size={16} /> Сохранить layout новой версией</button>
        <button onClick={() => copy(updatedPrompt, "Промпт")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-white"><Copy size={15} /> Скопировать промпт</button>
        {mode === "expert" ? <><button onClick={() => copy(JSON.stringify(layout, null, 2), "Layout JSON")} className="editor-action"><Copy size={15} /> Копировать Layout JSON</button><button onClick={() => { if (original) setNextLayout(original); setSelectedId(original?.elements[0]?.id ?? null); }} className="editor-action text-red-600"><RotateCcw size={15} /> Сбросить изменения</button></> : null}
        <span className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${promptSynchronized ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><Check size={14} /> {promptSynchronized ? "Промпт синхронизирован с Layout" : "Промпт не синхронизирован"}</span>
      </div>
    </section>
  );
}
function Field({ label, value, onChange, wide = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean; disabled?: boolean }) { return <label className={`text-xs font-bold text-muted ${wide ? "sm:col-span-2" : ""}`}>{label}<input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-[#ededf2]" /></label>; }
function NumberField({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) { return <label className="text-xs font-bold text-muted">{label}<input disabled={disabled} type="number" value={value} step={label === "Прозрачность" ? 0.1 : 1} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-[#ededf2]" /></label>; }
function TextPanel({ value, onCopy }: { value: string; onCopy: () => void }) { return <div className="p-5"><pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-2xl border border-line bg-[#fafaff] p-5 text-sm leading-6">{value}</pre><button onClick={onCopy} className="editor-action mt-3"><Copy size={15} /> Копировать</button></div>; }
function CodePanel({ title, value, editing = false, onChange, onCopy, onRefresh, onEdit, onSave, applyLabel }: {
  title: string; value: string; editing?: boolean; onChange?: (value: string) => void; onCopy: () => void;
  onRefresh: () => void; onEdit?: () => void; onSave?: () => void; applyLabel?: string;
}) {
  return <div className="p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-black">{title}</h3><div className="flex flex-wrap gap-2"><button onClick={onCopy} className="editor-action"><Copy size={15} /> Скопировать</button><button onClick={onRefresh} className="editor-action"><RotateCcw size={15} /> Обновить из Layout JSON</button>{onEdit && !editing ? <button onClick={onEdit} className="editor-action">Редактировать HTML</button> : null}</div></div>
    {editing ? <textarea value={value} onChange={(event) => onChange?.(event.target.value)} rows={30} className="w-full overflow-x-auto rounded-2xl border border-line bg-[#101223] p-5 font-mono text-xs leading-5 text-white" /> : <pre className="max-h-[680px] overflow-auto whitespace-pre rounded-2xl border border-line bg-[#101223] p-5 font-mono text-xs leading-5 text-white">{value}</pre>}
    {editing ? <div className="mt-3 flex flex-wrap gap-2"><button onClick={onSave} className="editor-action bg-violet text-white">Сохранить HTML новой версией</button>{applyLabel ? <button disabled title="Будет добавлено позже" className="editor-action cursor-not-allowed opacity-50">{applyLabel}</button> : null}</div> : null}
  </div>;
}
function pretty(value: string) { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }
const elementTypeLabels: Record<LayoutElement["type"], string> = { text: "Текст", card: "Карточка", button: "Кнопка", icon: "Иконка", avatar: "Аватар", image: "Изображение", illustration: "Иллюстрация", bottomNav: "Нижняя навигация", section: "Секция", input: "Поле ввода", chip: "Метка", badge: "Бейдж", progress: "Индикатор" };
function lockedElementChanges(current: LayoutJson, next: LayoutJson) {
  return current.elements.filter((element) => {
    if (!element.locked) return false;
    const candidate = next.elements.find((item) => item.id === element.id);
    if (!candidate) return true;
    const { locked: _oldLocked, ...oldValue } = element;
    const { locked: _newLocked, ...newValue } = candidate;
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  }).map((element) => element.id);
}
