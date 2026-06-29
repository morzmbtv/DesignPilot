# DesignPilot

DesignPilot — сервис для проектирования мобильных экранов: память проекта, AI Generate/Edit, Wireframe Preview, Layout Editor, Design Library и Component Intelligence Engine.

Основной сценарий развёртывания — Next.js на Vercel и PostgreSQL в Neon или Supabase. SQLite и локальный Docker не используются.

## Требования

- Node.js 20+
- PostgreSQL
- OpenRouter API key

## Переменные окружения

Создайте `.env.local` для локальной разработки:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_MODEL="openai/gpt-4o-mini"
NODE_ENV="development"
```

Не добавляйте `.env` и `.env.local` в Git.

## Бесплатная PostgreSQL в Neon

1. Создайте проект на [Neon](https://neon.com/).
2. Откройте **Connect** и скопируйте PostgreSQL connection string.
3. Для `DATABASE_URL` в Vercel используйте **Pooled connection** — в hostname есть `-pooler`.
4. Для команды `npm run db:migrate` временно используйте **Direct connection** без `-pooler`.
5. Проверьте, что обе строки начинаются с `postgresql://` и содержат `sslmode=require`.

Пример:

```env
DATABASE_URL="postgresql://user:password@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

В Vercel сохраняется только pooled URL. Direct URL нужен локально во время применения migrations. Подробнее: [Neon + Prisma](https://neon.com/docs/guides/prisma).

## Бесплатная PostgreSQL в Supabase

1. Создайте проект на [Supabase](https://supabase.com/).
2. Для `DATABASE_URL` в Vercel выберите **Transaction pooler** на порту `6543`.
3. Добавьте к URL параметры `pgbouncer=true`, `connection_limit=1` и `sslmode=require`.
4. Для `npm run db:migrate` временно используйте **Session pooler** на порту `5432`.

Пример:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
```

В Vercel хранится transaction URL. Session URL нужен локально во время применения migrations. Подробнее: [Prisma в Supabase](https://supabase.com/docs/guides/database/prisma).

## Первый запуск базы

Production использует чистую PostgreSQL baseline migration с полной схемой DesignPilot.

```bash
npm install
npm run db:migrate
npm run db:seed
```

Seed необязателен. На пустой production-базе его можно пропустить.

Для локальной разработки:

```bash
npm run dev
```

## Проверки

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

## Первый deploy через GitHub и Vercel

1. Отправьте проект в GitHub. Файлы `.env` коммитить нельзя.
2. Создайте пустую PostgreSQL базу в Neon или Supabase.
3. Локально временно задайте production `DATABASE_URL` и один раз выполните:

   PowerShell:

   ```bash
   $env:DATABASE_URL="postgresql://..."; npm run db:migrate
   ```

   macOS/Linux:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

   Или сохраните URL в локальном `.env`, выполните:

   ```bash
   npm run db:migrate
   ```

4. В [Vercel](https://vercel.com/new) выберите **Add New → Project** и импортируйте GitHub-репозиторий DesignPilot.
5. Framework Preset должен определиться как **Next.js**.
6. В **Settings → Environment Variables** добавьте для Production и Preview:

   ```text
   DATABASE_URL
   OPENROUTER_API_KEY
   OPENROUTER_MODEL
   NODE_ENV=production
   ```

7. Нажмите **Deploy**. Последующие push в `main` будут автоматически создавать production deployment.

Изменения переменных Vercel применяются только к новым deployment, поэтому после их редактирования выполните Redeploy.

## Миграции после изменения схемы

Создавайте migration в development-базе и коммитьте каталог `prisma/migrations`. Для production применяйте:

```bash
npm run db:migrate
```

`prisma migrate deploy` применяет только ещё не выполненные migration и не удаляет данные.

Импорт файлов в Design Library работает через браузер. Общий размер одной отправки должен быть меньше 4 МБ — это соответствует лимиту Vercel Functions.

## История миграций

Старые SQLite migrations несовместимы с PostgreSQL и заменены одной чистой baseline migration:

```text
prisma/migrations/20260629150000_postgresql_baseline
```

Эта история предназначена для новой пустой production PostgreSQL. Существующий локальный файл SQLite автоматически не переносится; при необходимости данные нужно экспортировать отдельно.
