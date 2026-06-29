"use client";

import { Box, Check, Library, Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  analyzeDesignImport,
  reuseExistingComponent,
  saveDesignComponent,
  saveDesignToken,
  setComponentStatus,
  setDesignSystemSource,
} from "@/app/projects/[id]/library/actions";
import { WireframePreview } from "@/components/wireframe/WireframePreview";
import { parseLayoutJson } from "@/lib/layout";
import { useInterfaceMode } from "@/components/interface-mode";

type ComponentItem = {
  id: string; name: string; description: string; category: string; preview: string | null; screenshot: string | null;
  layoutJson: string | null; dimensions: string | null; radius: string | null; colors: string | null; typography: string | null;
  spacing: string | null; states: string | null; variants: string | null; source: string; usageCount: number; approved: boolean;
  status: string; createdBy: string; basedOnComponents: string | null; creationReason: string | null; differences: string | null;
  imagePrompt: string | null; designSpec: string | null; usageGuidelines: string | null; accessibilityNotes: string | null;
  usedInScreens: string | null; editHistory: string | null; approveHistory: string | null;
  htmlLayout: string | null; flutterWidgetTree: string | null; sourceScreenId: string | null; sourceScreenVersionId: string | null;
  lastUsedAt: string | null; screensUsedIn: string | null; projectsUsedIn: string | null; similarityHistory: string | null;
};
type Props = {
  projectId: string; source: string; components: ComponentItem[];
  tokens: Array<{ id: string; group: string; name: string; value: string; description: string; source: string }>;
  assets: Array<{ id: string; name: string; type: string; preview: string | null; metadata: string | null }>;
  patterns: Array<{ id: string; name: string; category: string; description: string; usageCount: number }>;
  imports: Array<{ id: string; type: string; name: string; status: string; analysisJson: string | null; error: string | null; createdAt: string }>;
  reports: Array<{ id: string; candidateName: string; score: number; recommendation: string; reasonsJson: string | null }>;
};
const tabs = [
  ["overview", "Обзор"], ["components", "Компоненты"], ["assets", "Ресурсы"], ["tokens", "Токены"],
  ["patterns", "Паттерны"], ["imports", "Импорты"], ["drafts", "Черновики"], ["approved", "Утверждённые"], ["similarity", "Отчёт сходства"],
] as const;

export function LibraryPanel(props: Props) {
  const { mode } = useInterfaceMode();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("overview");
  const [components, setComponents] = useState(props.components);
  const [selected, setSelected] = useState<ComponentItem | null>(null);
  const [message, setMessage] = useState("");
  const drafts = components.filter((item) => item.status === "draft");
  const approved = components.filter((item) => item.approved);

  async function status(component: ComponentItem, next: "approved" | "rejected") {
    const result = await setComponentStatus(props.projectId, component.id, next);
    if (!result.ok) return setMessage(result.error);
    const updated = { ...component, status: next, approved: next === "approved" };
    setComponents((items) => items.map((item) => item.id === component.id ? updated : item));
    setSelected((current) => current?.id === component.id ? updated : current);
    setMessage(next === "approved" ? "Компонент добавлен в библиотеку." : "Компонент отклонён.");
  }

  async function reuse(component: ComponentItem) {
    const result = await reuseExistingComponent(props.projectId, component.id);
    if (!result.ok) return setMessage(result.error);
    setComponents((items) => items.map((item) => item.id === component.id ? { ...item, status: "rejected", approved: false } : item));
    setSelected(null);
    setMessage(`Используется существующий компонент «${result.componentName}». Черновик отклонён.`);
  }

  function updateComponent(updated: ComponentItem) {
    setComponents((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelected(updated);
  }

  return <>
    <div className="mt-7 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.filter(([id]) => mode === "expert" || !["patterns", "imports", "similarity"].includes(id)).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap px-4 py-3 text-sm font-bold ${tab === id ? "border-b-2 border-violet text-violet" : "text-muted"}`}>{label}{id === "drafts" && drafts.length ? ` (${drafts.length})` : ""}</button>)}
    </div>
    {message ? <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p> : null}
    {tab === "overview" ? <Overview {...props} components={components} drafts={drafts} approved={approved} /> : null}
    {tab === "components" ? <ComponentGrid items={components} onSelect={setSelected} /> : null}
    {tab === "drafts" ? <DraftGrid items={drafts} onSelect={setSelected} onStatus={status} onReuse={reuse} /> : null}
    {tab === "approved" ? <ComponentGrid items={approved} onSelect={setSelected} /> : null}
    {tab === "assets" ? <Assets items={props.assets} /> : null}
    {tab === "tokens" ? <Tokens projectId={props.projectId} items={props.tokens} onMessage={setMessage} /> : null}
    {tab === "patterns" ? <SimpleList items={props.patterns.map((item) => ({ title: item.name, subtitle: `${item.category} · использований: ${item.usageCount}`, body: item.description }))} empty="Паттерны появятся после анализа экранов и импортов." /> : null}
    {tab === "imports" ? <Imports projectId={props.projectId} items={props.imports} onMessage={setMessage} /> : null}
    {tab === "similarity" ? <Similarity items={props.reports} /> : null}
    {selected ? <Inspector projectId={props.projectId} component={selected} onClose={() => setSelected(null)} onStatus={status} onSaved={updateComponent} /> : null}
  </>;
}

function Overview(props: Props & { components: ComponentItem[]; drafts: ComponentItem[]; approved: ComponentItem[] }) {
  const stats = [["Компоненты", props.components.length], ["Утверждены", props.approved.length], ["Черновики", props.drafts.length], ["Токены", props.tokens.length], ["Ресурсы", props.assets.length], ["Импорты", props.imports.length]];
  return <div className="mt-7">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="rounded-[20px] border border-line bg-white p-5"><p className="text-sm font-bold text-muted">{label}</p><p className="mt-3 text-3xl font-black">{value}</p></div>)}</div>
    <Source projectId={props.projectId} value={props.source} />
    <div className="mt-6 rounded-[20px] border border-violet/15 bg-violet/[0.03] p-6"><h2 className="text-xl font-black">Как работает Component Intelligence</h2><ol className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-4"><li>1. Ищет компонент</li><li>2. Считает сходство</li><li>3. Переиспользует при &gt;90%</li><li>4. Иначе создаёт проверяемый черновик</li></ol></div>
  </div>;
}

function Source({ projectId, value }: { projectId: string; value: string }) {
  const [source, setSource] = useState(value);
  return <div className="mt-6 rounded-[20px] border border-line bg-white p-5"><h2 className="font-black">Источник дизайн-системы</h2><p className="mt-1 text-sm text-muted">AI использует только выбранную библиотеку и не придумывает произвольный стиль.</p><div className="mt-4 flex flex-wrap gap-3"><select value={source} onChange={(event) => setSource(event.target.value)} className="h-11 rounded-xl border border-line px-4"><option value="current_library">Библиотека текущего проекта</option><option value="flutter_project">Flutter-проект</option><option value="figma_export">Figma-экспорт</option><option value="images">Изображения</option><option value="designpilot_project">Другой проект DesignPilot</option></select><button onClick={() => setDesignSystemSource(projectId, source)} className="h-11 rounded-xl bg-violet px-5 text-sm font-bold text-white">Сохранить источник</button></div></div>;
}

function ComponentGrid({ items, onSelect }: { items: ComponentItem[]; onSelect: (item: ComponentItem) => void }) {
  return <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.length ? items.map((item) => {
    const screens = readStringList(item.usedInScreens);
    return <button key={item.id} onClick={() => onSelect(item)} className="rounded-[20px] border border-line bg-white p-5 text-left hover:border-violet/30"><div className="flex items-start justify-between"><span className="flex size-11 items-center justify-center rounded-xl bg-violet/10 text-violet"><Box size={20} /></span><Status status={item.status} /></div><h3 className="mt-4 text-lg font-black">{item.name}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{item.description || "Описание не добавлено"}</p><div className="mt-4 space-y-1 text-xs text-muted"><p><strong className="text-violet">Количество использований:</strong> {item.usageCount}</p><p><strong>Используется в:</strong> {screens.length ? screens.join(", ") : "пока нигде"}</p><p><strong>Последнее использование:</strong> {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString("ru-RU") : "—"}</p></div></button>;
  }) : <Empty text="Компонентов пока нет. Запустите импорт, чтобы получить предложения." />}</div>;
}

function DraftGrid({ items, onSelect, onStatus, onReuse }: { items: ComponentItem[]; onSelect: (item: ComponentItem) => void; onStatus: (item: ComponentItem, status: "approved" | "rejected") => void; onReuse: (item: ComponentItem) => void }) {
  return <div className="mt-7 space-y-4">{items.length ? items.map((item) => <article key={item.id} className="rounded-[20px] border border-amber-200 bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:justify-between"><div><div className="flex items-center gap-2"><h3 className="text-lg font-black">{item.name}</h3><Status status="draft" /></div><p className="mt-2 text-sm text-muted">{item.creationReason || "AI не нашёл компонент с достаточной похожестью."}</p><p className="mt-2 text-sm font-bold text-violet">{item.differences}</p></div><div className="flex flex-wrap gap-2">{readStringList(item.basedOnComponents).length ? <button onClick={() => onReuse(item)} className="lib-button border border-violet text-violet"><Library size={15} /> Использовать существующий</button> : null}<button onClick={() => onStatus(item, "approved")} className="lib-button bg-violet text-white"><Check size={15} /> Создать новый</button><button onClick={() => onStatus(item, "rejected")} className="lib-button border border-red-200 text-red-600"><X size={15} /> Отклонить</button><button onClick={() => onSelect(item)} className="lib-button border border-line">Открыть и изменить</button></div></div></article>) : <Empty text="Черновиков компонентов нет." />}</div>;
}

function Assets({ items }: { items: Props["assets"] }) {
  return <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.length ? items.map((item) => <div key={item.id} className="rounded-[20px] border border-line bg-white p-4">{item.preview ? <img src={item.preview} alt={item.name} className="aspect-video w-full rounded-xl object-cover" /> : <div className="flex aspect-video items-center justify-center rounded-xl bg-[#f3f3f8] text-muted"><Library /></div>}<h3 className="mt-3 font-black">{item.name}</h3><p className="mt-1 text-xs text-muted">{item.type}</p></div>) : <Empty text="Импортированных ресурсов пока нет." />}</div>;
}

function Tokens({ projectId, items, onMessage }: { projectId: string; items: Props["tokens"]; onMessage: (value: string) => void }) {
  const groups = useMemo(() => Array.from(new Set(items.map((item) => item.group))), [items]);
  const [draft, setDraft] = useState({ group: "Цвета", name: "", value: "" });
  return <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_330px]"><div className="space-y-5">{groups.length ? groups.map((group) => <section key={group} className="rounded-[20px] border border-line bg-white p-5"><h2 className="font-black">{group}</h2><div className="mt-4 divide-y divide-line">{items.filter((item) => item.group === group).map((item) => <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 py-3 text-sm"><strong>{item.name}</strong><code>{item.value}</code><span className="text-xs text-muted">{item.source}</span></div>)}</div></section>) : <Empty text="Токенов пока нет." />}</div><form onSubmit={async (event) => { event.preventDefault(); const result = await saveDesignToken(projectId, draft); onMessage(result.ok ? "Токен сохранён." : result.error); }} className="h-fit rounded-[20px] border border-line bg-white p-5"><h2 className="font-black">Добавить или обновить токен</h2>{(["group", "name", "value"] as const).map((key) => <label key={key} className="mt-4 block text-xs font-bold text-muted">{key === "group" ? "Группа" : key === "name" ? "Название" : "Значение"}<input required value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-sm" /></label>)}<button className="mt-5 h-11 w-full rounded-xl bg-violet text-sm font-bold text-white">Сохранить токен</button></form></div>;
}

function Imports({ projectId, items, onMessage }: { projectId: string; items: Props["imports"]; onMessage: (value: string) => void }) {
  return <div className="mt-7 grid gap-6 xl:grid-cols-[390px_1fr]"><form action={async (data) => { const result = await analyzeDesignImport(projectId, data); onMessage(result.ok ? "Импорт проанализирован. Предложения добавлены в черновики." : result.error); }} className="h-fit rounded-[20px] border border-line bg-white p-5"><h2 className="text-lg font-black">Новый импорт</h2><label className="mt-4 block text-xs font-bold text-muted">Тип<select name="type" className="mt-1 h-11 w-full rounded-xl border border-line px-3"><option value="flutter_project">Flutter-проект / widgets</option><option value="figma_export">Figma Export ZIP</option><option value="image">PNG / JPG / SVG / PDF</option><option value="design_tokens_json">Design Tokens JSON</option><option value="layout_json">Layout JSON</option><option value="theme_file">Файл темы</option><option value="icon_library">Библиотека иконок</option></select></label><label className="mt-4 block text-xs font-bold text-muted">Файлы<input type="file" name="files" multiple accept=".png,.jpg,.jpeg,.svg,.pdf,.zip,.json,.dart" className="mt-1 block w-full text-sm" /><span className="mt-2 block font-normal leading-5">Для Flutter выберите `.dart`-файлы проекта. Они загружаются через браузер — локальный путь не требуется.</span></label><label className="mt-4 block text-xs font-bold text-muted">JSON / тема<textarea name="payload" rows={6} className="mt-1 w-full rounded-xl border border-line p-3 font-mono text-xs" /></label><button className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet text-sm font-bold text-white"><Upload size={16} /> Анализировать импорт</button></form><SimpleList items={items.map((item) => ({ title: item.name, subtitle: `${item.type} · ${item.status}`, body: item.error || item.analysisJson || "" }))} empty="Импортов пока нет." /></div>;
}

function Similarity({ items }: { items: Props["reports"] }) {
  return <div className="mt-7 space-y-3">{items.length ? items.map((item) => <div key={item.id} className="rounded-[20px] border border-line bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="font-black">{item.candidateName}</h3><p className="mt-1 text-sm text-muted">{item.recommendation === "reuse" ? "Использовать существующий компонент" : item.recommendation === "review" ? "Предложить выбор пользователю" : "Создать черновик компонента"}</p></div><span className={`text-2xl font-black ${item.score >= 90 ? "text-emerald-600" : item.score >= 70 ? "text-amber-600" : "text-red-600"}`}>{Math.round(item.score)}%</span></div></div>) : <Empty text="Отчётов сходства пока нет." />}</div>;
}

function Inspector({ projectId, component, onClose, onStatus, onSaved }: { projectId: string; component: ComponentItem; onClose: () => void; onStatus: (item: ComponentItem, status: "approved" | "rejected") => void; onSaved: (item: ComponentItem) => void }) {
  const { mode } = useInterfaceMode();
  const [draft, setDraft] = useState({ name: component.name, description: component.description, category: component.category, layoutJson: component.layoutJson || "", states: component.states || "[]", variants: component.variants || "[]", usageGuidelines: component.usageGuidelines || "", accessibilityNotes: component.accessibilityNotes || "" });
  const [message, setMessage] = useState("");
  const layout = parseLayoutJson(draft.layoutJson).layout;
  async function save() {
    const result = await saveDesignComponent(projectId, component.id, draft);
    if (!result.ok) return setMessage(result.error);
    onSaved({ ...component, ...draft, layoutJson: draft.layoutJson || null, states: draft.states || null, variants: draft.variants || null, usageGuidelines: draft.usageGuidelines || null, accessibilityNotes: draft.accessibilityNotes || null });
    setMessage("Изменения компонента сохранены.");
  }
  return <div className="fixed inset-0 z-50 flex justify-end bg-ink/35"><button className="absolute inset-0" onClick={onClose} aria-label="Закрыть инспектор" /><aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-violet">Инспектор компонента</p><h2 className="mt-2 text-2xl font-black">{component.name}</h2></div><button onClick={onClose} aria-label="Закрыть" className="flex size-10 items-center justify-center rounded-xl border border-line"><X /></button></div>{layout ? <div className="mx-auto mt-6 max-w-[260px]"><WireframePreview layout={layout} selectedId={null} onSelect={() => {}} onChange={() => {}} showGrid={false} /></div> : <div className="mt-6 rounded-2xl bg-[#f3f3f8] p-10 text-center text-sm text-muted">Схема пока не создана</div>}<div className="mt-5 rounded-2xl bg-[#f7f7fb] p-4 text-sm"><p><strong>Количество использований:</strong> {component.usageCount}</p><p className="mt-1"><strong>Используется в:</strong> {readStringList(component.usedInScreens).join(", ") || "пока нигде"}</p><p className="mt-1"><strong>Последнее использование:</strong> {component.lastUsedAt ? new Date(component.lastUsedAt).toLocaleString("ru-RU") : "—"}</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Название" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><Field label="Категория" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} /><Field label="Описание" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} wide />{mode === "expert" ? <><Area label="Layout JSON" value={draft.layoutJson} onChange={(layoutJson) => setDraft({ ...draft, layoutJson })} /><Area label="Состояния (JSON)" value={draft.states} onChange={(states) => setDraft({ ...draft, states })} /><Area label="Варианты (JSON)" value={draft.variants} onChange={(variants) => setDraft({ ...draft, variants })} /></> : null}<Area label="Правила использования" value={draft.usageGuidelines} onChange={(usageGuidelines) => setDraft({ ...draft, usageGuidelines })} /><Area label="Доступность" value={draft.accessibilityNotes} onChange={(accessibilityNotes) => setDraft({ ...draft, accessibilityNotes })} /></div>{message ? <p className="mt-4 rounded-xl bg-violet/5 p-3 text-sm font-bold text-violet">{message}</p> : null}<div className="mt-6 flex flex-wrap gap-2"><button onClick={save} className="lib-button bg-ink text-white">Сохранить изменения</button><button onClick={() => onStatus(component, "approved")} className="lib-button bg-violet text-white">Утвердить</button><button onClick={() => onStatus(component, "rejected")} className="lib-button border border-red-200 text-red-600">Отклонить</button></div>{component.designSpec && mode === "expert" ? <Long label="Спецификация дизайна" value={component.designSpec} /> : null}{component.imagePrompt && mode === "expert" ? <Long label="Промпт изображения" value={component.imagePrompt} /> : null}{mode === "expert" ? <>{component.htmlLayout ? <Long label="HTML Layout" value={component.htmlLayout} /> : null}{component.flutterWidgetTree ? <Long label="Дерево Flutter" value={component.flutterWidgetTree} /> : null}<Long label="История сходства" value={component.similarityHistory || "История пока пуста"} /><Long label="История изменений" value={component.editHistory || "История пока пуста"} /><Long label="История утверждений" value={component.approveHistory || "История пока пуста"} /></> : null}</aside></div>;
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <label className={`text-xs font-bold text-muted ${wide ? "sm:col-span-2" : ""}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-sm text-ink" /></label>; }
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-bold text-muted">{label}<textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-line p-3 font-mono text-xs text-ink" /></label>; }
function Long({ label, value }: { label: string; value: string }) { return <div className="mt-4 rounded-2xl border border-line p-4"><p className="text-xs font-bold text-muted">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{value}</p></div>; }
function SimpleList({ items, empty }: { items: Array<{ title: string; subtitle: string; body: string }>; empty: string }) { return <div className="space-y-3">{items.length ? items.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-[20px] border border-line bg-white p-5"><h3 className="font-black">{item.title}</h3><p className="mt-1 text-xs font-bold text-violet">{item.subtitle}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-muted">{item.body}</p></div>) : <Empty text={empty} />}</div>; }
function Status({ status }: { status: string }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{status === "approved" ? "Утверждён" : status === "rejected" ? "Отклонён" : "Черновик"}</span>; }
function Empty({ text }: { text: string }) { return <div className="col-span-full rounded-[20px] border border-dashed border-line bg-white py-12 text-center text-sm text-muted">{text}</div>; }
function readStringList(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
