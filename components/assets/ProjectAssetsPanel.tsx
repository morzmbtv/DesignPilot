"use client";

import { Download, ImagePlus, Loader2, RefreshCw, Sparkles, Star, Trash2, Upload } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addProjectAssetToScreen,
  deleteProjectAsset,
  generateProjectAsset,
  setPrimaryProjectLogo,
  uploadProjectAsset,
} from "@/app/projects/[id]/assets/actions";
import { PROJECT_ASSET_TYPES, PROJECT_ASSET_TYPE_LABELS, formatAssetSize, type ProjectAssetType } from "@/lib/assets";

type AssetItem = {
  id: string; name: string; type: string; source: string; mimeType: string; fileName: string | null;
  fileSize: number | null; width: number | null; height: number | null; dataUrl: string | null; fileUrl: string | null;
  prompt: string | null; provider: string | null; model: string | null; isPrimaryLogo: boolean; isBrandAsset: boolean;
  usageCount: number; createdAt: string; updatedAt: string;
};

export function ProjectAssetsPanel({ projectId, initialAssets, screens, imageModelConfigured }: {
  projectId: string;
  initialAssets: AssetItem[];
  screens: Array<{ id: string; name: string; status: string }>;
  imageModelConfigured: boolean;
}) {
  const router = useRouter();
  const [selectedScreenId, setSelectedScreenId] = useState(screens[0]?.id || "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [generatedAssetId, setGeneratedAssetId] = useState<string | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("upload"); resetNotice();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (file instanceof File) {
      const dimensions = await readImageDimensions(file);
      if (dimensions) {
        data.set("width", String(dimensions.width));
        data.set("height", String(dimensions.height));
      }
    }
    const result = await uploadProjectAsset(projectId, data);
    setBusy("");
    if (!result.ok) return setError(result.error);
    setMessage(result.message);
    form.reset();
    router.refresh();
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("generate"); resetNotice();
    const data = new FormData(event.currentTarget);
    const result = await generateProjectAsset(projectId, {
      name: String(data.get("name") || ""),
      type: String(data.get("type") || "illustration"),
      description: String(data.get("description") || ""),
      useProjectStyle: data.get("useProjectStyle") === "on",
    });
    setBusy("");
    if (!result.ok) return setError(result.error);
    setMessage(`${result.message} Теперь его можно добавить на выбранный экран.`);
    setGeneratedAssetId(result.assetId || null);
    router.refresh();
  }

  async function mutate(key: string, callback: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setBusy(key); resetNotice();
    const result = await callback();
    setBusy("");
    if (!result.ok) return setError(result.error || "Операция не выполнена.");
    setMessage(result.message || "Готово.");
    router.refresh();
  }

  function resetNotice() {
    setMessage("");
    setError("");
  }

  return (
    <div className="mt-8 space-y-8">
      {message ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={upload} className="rounded-[22px] border border-line bg-white p-6">
          <div className="flex items-center gap-3"><Upload className="text-violet" /><div><h2 className="text-xl font-black">Загрузить ассет</h2><p className="text-xs text-muted">PNG, JPG, WEBP или SVG · максимум 4 МБ</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Название"><input name="name" placeholder="Логотип EDUS" className="asset-input" /></Field>
            <Field label="Тип"><AssetTypeSelect name="type" /></Field>
            <Field label="Файл" wide><input name="file" type="file" required accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" className="asset-input file:mr-3 file:rounded-lg file:border-0 file:bg-violet/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-violet" /></Field>
            <label className="flex items-center gap-2 text-sm font-bold"><input name="isBrandAsset" type="checkbox" /> Брендовый ассет</label>
            <label className="flex items-center gap-2 text-sm font-bold"><input name="isPrimaryLogo" type="checkbox" /> Сделать основным логотипом</label>
          </div>
          <button disabled={busy === "upload"} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white disabled:opacity-50">{busy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Загрузить</button>
        </form>

        <form onSubmit={generate} className="rounded-[22px] border border-violet/20 bg-violet/[0.035] p-6">
          <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Sparkles className="text-violet" /><div><h2 className="text-xl font-black">Сгенерировать ассет</h2><p className="text-xs text-muted">OpenRouter Image API</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${imageModelConfigured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{imageModelConfigured ? "Модель настроена" : "Модель не настроена"}</span></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Название"><input name="name" required placeholder="Мальчик с рюкзаком" className="asset-input" /></Field>
            <Field label="Тип"><AssetTypeSelect name="type" defaultValue="illustration" /></Field>
            <Field label="Описание" wide><textarea name="description" required rows={4} placeholder="Например: 3D мальчик с рюкзаком, дружелюбный современный стиль" className="asset-input h-auto resize-y py-3" /></Field>
            <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><input name="useProjectStyle" type="checkbox" defaultChecked /> Использовать стиль и правила проекта</label>
          </div>
          <button disabled={busy === "generate" || !imageModelConfigured} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white disabled:opacity-50">{busy === "generate" ? <Loader2 size={16} className="animate-spin" /> : generatedAssetId ? <RefreshCw size={16} /> : <Sparkles size={16} />} {generatedAssetId ? "Повторить генерацию" : "Сгенерировать"}</button>
        </form>
      </div>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-2xl font-black">Ассеты проекта</h2><p className="mt-1 text-sm text-muted">{initialAssets.length ? `${initialAssets.length} файлов` : "Библиотека пока пуста"}</p></div>
          <label className="text-xs font-bold text-muted">Текущий экран<select value={selectedScreenId} onChange={(event) => setSelectedScreenId(event.target.value)} className="mt-1 h-11 min-w-64 rounded-xl border border-line bg-white px-3 text-sm text-ink"><option value="">Выберите экран</option>{screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.name} · {screen.status === "approved" ? "утверждён" : "черновик"}</option>)}</select></label>
        </div>
        {initialAssets.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">{initialAssets.map((asset) => {
          const source = asset.dataUrl || asset.fileUrl || "";
          return <article key={asset.id} className={`overflow-hidden rounded-[22px] border bg-white ${asset.id === generatedAssetId ? "border-violet ring-2 ring-violet/15" : "border-line"}`}>
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[linear-gradient(45deg,#f1f2f6_25%,transparent_25%),linear-gradient(-45deg,#f1f2f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f2f6_75%),linear-gradient(-45deg,transparent_75%,#f1f2f6_75%)] bg-[length:20px_20px]">
              {source ? <img src={source} alt={asset.name} className="max-h-full max-w-full object-contain" /> : <ImagePlus size={36} className="text-muted" />}
              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">{asset.isPrimaryLogo ? <Badge tone="violet">Основной логотип</Badge> : null}{asset.isBrandAsset ? <Badge tone="ink">Брендовый ассет</Badge> : null}</div>
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{asset.name}</h3><p className="mt-1 text-xs text-muted">{PROJECT_ASSET_TYPE_LABELS[asset.type as ProjectAssetType] || asset.type} · {asset.source === "uploaded" ? "загружен" : asset.source === "openrouter" ? "OpenRouter" : "вручную"}</p></div><span className="rounded-full bg-[#f3f3f8] px-2.5 py-1 text-[10px] font-bold">{formatAssetSize(asset.fileSize)}</span></div>
              <p className="mt-3 text-xs text-muted">{asset.width && asset.height ? `${asset.width} × ${asset.height} px · ` : ""}Использований: {asset.usageCount}</p>
              {asset.model ? <p className="mt-1 truncate text-[10px] text-muted">Модель: {asset.model}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={!selectedScreenId || busy === `add-${asset.id}`} onClick={() => mutate(`add-${asset.id}`, () => addProjectAssetToScreen(projectId, asset.id, selectedScreenId))} className="asset-action bg-violet text-white disabled:opacity-40"><ImagePlus size={14} /> Добавить на экран</button>
                {source ? <a href={source} download={asset.fileName || asset.name} className="asset-action border border-line"><Download size={14} /> Скачать</a> : null}
                {asset.type === "logo" && !asset.isPrimaryLogo ? <button onClick={() => mutate(`primary-${asset.id}`, () => setPrimaryProjectLogo(projectId, asset.id))} className="asset-action border border-line"><Star size={14} /> Сделать основным</button> : null}
                <button onClick={() => { if (window.confirm(`Удалить ассет «${asset.name}»?`)) void mutate(`delete-${asset.id}`, () => deleteProjectAsset(projectId, asset.id)); }} className="asset-action border border-red-100 text-red-600"><Trash2 size={14} /> Удалить</button>
              </div>
            </div>
          </article>;
        })}</div> : <div className="mt-5 rounded-[22px] border border-dashed border-line bg-white py-16 text-center"><ImagePlus className="mx-auto text-muted" /><h3 className="mt-4 text-lg font-black">Пока нет ассетов</h3><p className="mt-2 text-sm text-muted">Загрузите логотип или сгенерируйте первую иллюстрацию.</p></div>}
      </section>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`text-xs font-bold text-muted ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}
function AssetTypeSelect({ name, defaultValue = "other" }: { name: string; defaultValue?: ProjectAssetType }) {
  return <select name={name} defaultValue={defaultValue} className="asset-input">{PROJECT_ASSET_TYPES.map((type) => <option key={type} value={type}>{PROJECT_ASSET_TYPE_LABELS[type]}</option>)}</select>;
}
function Badge({ children, tone }: { children: React.ReactNode; tone: "violet" | "ink" }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black text-white shadow-sm ${tone === "violet" ? "bg-violet" : "bg-ink"}`}>{children}</span>;
}
async function readImageDimensions(file: File) {
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    const document = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = document.documentElement;
    const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
    const width = Number.parseFloat(svg.getAttribute("width") || "") || (viewBox?.[2] ?? 0);
    const height = Number.parseFloat(svg.getAttribute("height") || "") || (viewBox?.[3] ?? 0);
    return width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : null;
  }
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = url;
    });
    return dimensions;
  } finally {
    URL.revokeObjectURL(url);
  }
}
