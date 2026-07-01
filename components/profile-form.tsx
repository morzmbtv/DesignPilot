"use client";

import { useState } from "react";
import { saveProfile } from "@/app/settings/profile/actions";

export function ProfileForm({ initial }: { initial: { name: string; email: string; defaultLanguage: string; interfaceMode: string; defaultModel: string } }) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await saveProfile(form);
    setMessage(result.ok ? "Настройки сохранены" : result.error);
    setBusy(false);
  }
  return <form onSubmit={submit} className="mt-7 grid gap-5 sm:grid-cols-2">
    <Field label="Имя" value={form.name} onChange={(name) => setForm({ ...form, name })} />
    <Field label="Email" value={form.email} disabled onChange={() => {}} />
    <Field label="Язык" value={form.defaultLanguage} onChange={(defaultLanguage) => setForm({ ...form, defaultLanguage })} />
    <label className="text-sm font-bold">Режим интерфейса<select value={form.interfaceMode} onChange={(event) => setForm({ ...form, interfaceMode: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4"><option value="simple">Дизайнер</option><option value="expert">Разработчик</option></select></label>
    <div className="sm:col-span-2"><Field label="Модель OpenRouter по умолчанию" value={form.defaultModel} onChange={(defaultModel) => setForm({ ...form, defaultModel })} placeholder="openai/gpt-4o-mini" /></div>
    <div className="flex items-center gap-4 sm:col-span-2"><button disabled={busy} className="h-11 rounded-xl bg-violet px-5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Сохраняем…" : "Сохранить"}</button>{message ? <p className="text-sm font-bold text-violet">{message}</p> : null}</div>
  </form>;
}

function Field({ label, value, onChange, disabled, placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string }) {
  return <label className="text-sm font-bold">{label}<input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder={placeholder} className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 disabled:bg-[#f3f3f7]" /></label>;
}
