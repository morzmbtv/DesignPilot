"use client";

import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

const screenTypes = ["Splash", "Onboarding", "Dashboard", "Список", "Детали", "Форма", "Профиль", "Настройки", "Другое"];
const styleSources = ["Стиль текущего проекта", "Выбранные референсы", "Похожий экран", "Библиотека компонентов"];

export function ScreenCreationWizard({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState("Splash");
  const [content, setContent] = useState("");
  const [style, setStyle] = useState(styleSources[0]);
  const purpose = useMemo(() => `Тип: ${type}. ${content.trim()} Стиль: ${style}.`, [content, style, type]);

  return <form action={action} className="rounded-[20px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(17,19,38,0.02)]">
    <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-violet">Шаг {step} из 4</p><h2 className="mt-1 text-xl font-black">Новый экран</h2></div><span className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet"><Sparkles size={19} /></span></div>
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#eeeeF5]"><div className="h-full rounded-full bg-violet transition-all" style={{ width: `${step * 25}%` }} /></div>
    <input type="hidden" name="name" value={name} /><input type="hidden" name="purpose" value={purpose} />
    {step === 1 ? <label className="mt-6 block text-sm font-bold">Название экрана<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Splash" className="mt-2 h-12 w-full rounded-xl border border-line px-4 text-sm" /></label> : null}
    {step === 2 ? <div className="mt-6"><p className="text-sm font-bold">Тип экрана</p><div className="mt-3 grid grid-cols-2 gap-2">{screenTypes.map((item) => <button type="button" key={item} onClick={() => setType(item)} className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold ${type === item ? "border-violet bg-violet/5 text-violet" : "border-line"}`}>{item}</button>)}</div></div> : null}
    {step === 3 ? <label className="mt-6 block text-sm font-bold">Что должно быть на экране?<textarea autoFocus value={content} onChange={(event) => setContent(event.target.value)} rows={6} placeholder="Например: логотип, короткое приветствие и кнопка «Начать»" className="mt-2 w-full resize-y rounded-xl border border-line p-4 text-sm leading-6" /></label> : null}
    {step === 4 ? <div className="mt-6"><p className="text-sm font-bold">Использовать стиль</p><div className="mt-3 space-y-2">{styleSources.map((item) => <label key={item} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-bold ${style === item ? "border-violet bg-violet/5" : "border-line"}`}><input type="radio" checked={style === item} onChange={() => setStyle(item)} /> {item}</label>)}</div></div> : null}
    <div className="mt-6 flex gap-2">{step > 1 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold"><ArrowLeft size={16} /> Назад</button> : null}<div className="ml-auto">{step < 4 ? <button type="button" disabled={step === 1 && !name.trim()} onClick={() => setStep((current) => current + 1)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white disabled:opacity-40">Далее <ArrowRight size={16} /></button> : <button disabled={!name.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-bold text-white"><Sparkles size={16} /> Сгенерировать экран</button>}</div></div>
  </form>;
}
