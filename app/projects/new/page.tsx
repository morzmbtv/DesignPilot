import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createProject } from "@/app/actions";
import Link from "next/link";
import { PLATFORM_LABELS, PLATFORMS, PROJECT_TYPE_LABELS, PROJECT_TYPES, VIEWPORT_PRESETS } from "@/lib/project-config";

export default function NewProjectPage() {
  return (
    <AppShell>
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-violet">
        <ArrowLeft size={17} /> Все проекты
      </Link>
      <div className="mt-8 max-w-5xl rounded-[22px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(17,19,38,0.02)] sm:p-8">
        <h1 className="text-4xl font-black tracking-[-0.04em]">Новый проект</h1>
        <p className="mt-3 text-muted">Зафиксируйте продуктовый и визуальный контекст приложения.</p>
        <form action={createProject} className="mt-10 grid gap-6 sm:grid-cols-2">
          <Field label="Название" name="name" placeholder="Например, Finora" required />
          <SelectField label="Тип проекта" name="projectType" defaultValue="mobile_app" options={PROJECT_TYPES.map((item) => [item, PROJECT_TYPE_LABELS[item]])} />
          <SelectField label="Платформа" name="platform" defaultValue="ios" options={PLATFORMS.map((item) => [item, PLATFORM_LABELS[item]])} />
          <SelectField label="Viewport" name="viewportPreset" defaultValue="iphone_390x844" options={Object.entries(VIEWPORT_PRESETS).map(([key, item]) => [key, item.label])} />
          <div className="grid grid-cols-2 gap-3"><Field label="Custom width" name="customViewportWidth" type="number" min={240} placeholder="390" /><Field label="Custom height" name="customViewportHeight" type="number" min={320} placeholder="844" /></div>
          <div className="sm:col-span-2">
            <Field label="Описание" name="description" placeholder="Коротко о продукте" multiline />
          </div>
          <Field label="Целевая аудитория" name="targetUsers" placeholder="Для кого создаётся приложение?" multiline />
          <Field label="Цель приложения" name="appGoal" placeholder="Какую задачу решает продукт?" multiline />
          <Field label="Стилевое направление" name="styleDirection" placeholder="Спокойный, технологичный..." multiline />
          <Field label="Требования к дизайну" name="designRequirements" placeholder="Компоненты, сетка, доступность..." multiline />
          <Field label="Архитектура" name="architectureNotes" placeholder="Разделы и пользовательские потоки" multiline />
          <Field label="Ограничения" name="constraints" placeholder="Что важно исключить или учесть?" multiline />
          <div className="flex items-center gap-3 pt-2 sm:col-span-2">
            <button className="inline-flex h-12 items-center rounded-xl bg-violet px-6 text-sm font-bold text-white shadow-soft hover:bg-[#4e30df]">
              Создать проект
            </button>
            <Link href="/" className="px-4 py-3 text-sm font-bold text-muted">Отмена</Link>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function SelectField({ label, name, options, defaultValue }: { label: string; name: string; options: string[][]; defaultValue: string }) {
  return <label className="block text-sm font-bold text-ink">{label}<select name={name} defaultValue={defaultValue} className="mt-2 h-12 w-full rounded-xl border border-line bg-white px-4 text-sm">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function Field({ label, multiline, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; multiline?: boolean }) {
  const classes = "mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-violet";
  return (
    <label className="block text-sm font-bold text-ink">
      {label}
      {multiline ? <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} className={`${classes} min-h-28 resize-y`} /> : <input {...props} className={classes} />}
    </label>
  );
}
