# DesignPilot

DesignPilot — сервис для проектирования мобильных экранов: память проекта, AI Generate/Edit, Wireframe Preview, Layout Editor, Design Library, Component Intelligence Engine и личные аккаунты пользователей.

Основной сценарий развёртывания — Next.js на Vercel и PostgreSQL в Neon или Supabase. SQLite и локальный Docker больше не используются как основной путь.

## Требования

- Node.js 20+
- PostgreSQL
- OpenRouter API key
- Vercel project для production deployment

## Переменные окружения

Создайте `.env.local` для локальной разработки или добавьте эти переменные в Vercel:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-random-long-secret"
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_MODEL="openai/gpt-4o-mini"
OPENROUTER_IMAGE_MODEL="openai/gpt-image-1"
# Необязательно: модели перебираются слева направо, если основная недоступна.
OPENROUTER_IMAGE_FALLBACK_MODELS=""
INITIAL_ADMIN_EMAIL="admin@designpilot.local"
NODE_ENV="development"
```

Для Vercel:

```text
DATABASE_URL
NEXTAUTH_URL=https://your-designpilot.vercel.app
NEXTAUTH_SECRET
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENROUTER_IMAGE_MODEL
OPENROUTER_IMAGE_FALLBACK_MODELS
INITIAL_ADMIN_EMAIL
NODE_ENV=production
```

Не добавляйте `.env` и `.env.local` в Git.

### Ассеты и OpenRouter Image

DesignPilot использует отдельный OpenRouter Image API (`POST /api/v1/images`). Укажите slug модели с поддержкой image output в `OPENROUTER_IMAGE_MODEL`. Актуальные модели можно получить через `GET https://openrouter.ai/api/v1/images/models`.

1. Откройте проект и выберите пункт **Ассеты**.
2. Для загрузки логотипа выберите тип **Логотип**, файл PNG/JPG/WEBP/SVG размером до 4 МБ и отметьте **Сделать основным логотипом**.
3. Основной логотип автоматически передаётся в AI context как `assetRef`; DesignPilot запрещает модели перерисовывать его.
4. В блоке **Сгенерировать ассет** укажите название, тип и описание. Результат сохраняется в PostgreSQL как data URL.
5. Выберите текущий экран и нажмите **Добавить на экран**. Будет создана новая версия экрана, а ассет появится на Canvas и в Layers.
6. Оригинал можно скачать из карточки ассета или из Inspector выбранного слоя.

В **Настройки → OpenRouter** доступен тест image generation. Он создаёт тестовую иконку в выбранном проекте. Если `OPENROUTER_IMAGE_MODEL` отсутствует, интерфейс показывает ошибку «Image model не настроена».

Для MVP файлы хранятся в PostgreSQL. Лимит одного загружаемого или сгенерированного файла — 4 МБ; в будущем хранилище можно заменить на Vercel Blob/S3 без изменения IDM.

### Как сгенерировать NEXTAUTH_SECRET

PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

macOS/Linux:

```bash
openssl rand -base64 32
```

## PostgreSQL в Neon

1. Создайте проект на [Neon](https://neon.com/).
2. Откройте **Connect** и скопируйте PostgreSQL connection string.
3. Для `DATABASE_URL` в Vercel используйте pooled connection — обычно в hostname есть `-pooler`.
4. Для `npm run db:migrate` временно используйте direct connection без `-pooler`.
5. URL должен начинаться с `postgresql://` и содержать `sslmode=require`.

Пример:

```env
DATABASE_URL="postgresql://user:password@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
```

## PostgreSQL в Supabase

1. Создайте проект на [Supabase](https://supabase.com/).
2. Для `DATABASE_URL` в Vercel используйте Transaction pooler на порту `6543`.
3. Добавьте параметры `pgbouncer=true`, `connection_limit=1` и `sslmode=require`.
4. Для `npm run db:migrate` временно используйте Session pooler на порту `5432`.

Пример:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
```

## Первый запуск базы

Production использует PostgreSQL migrations:

```bash
npm install
npm run db:migrate
```

Seed необязателен:

```bash
npm run db:seed
```

## Авторизация и первый пользователь

DesignPilot использует Auth.js / NextAuth с email + password. Пароли хранятся только как bcrypt hash.

После деплоя откройте:

```text
/register
```

и создайте аккаунт. Новые проекты будут автоматически принадлежать текущему пользователю.

Если в базе уже есть старые проекты без владельца, привяжите их к первому пользователю:

```bash
INITIAL_ADMIN_EMAIL="you@example.com" npm run db:assign-owner
```

PowerShell:

```powershell
$env:INITIAL_ADMIN_EMAIL="you@example.com"; npm run db:assign-owner
```

Скрипт:

- найдёт или создаст пользователя с указанным email;
- создаст `UserSettings`, если их нет;
- присвоит `Project.userId` всем старым проектам без владельца;
- не удаляет данные.

Если пользователь был создан скриптом без пароля, зарегистрируйтесь через `/register` с тем же email — аккаунт получит пароль и сохранит привязанные проекты.

## Восстановление migration history для существующей production-базы

Если таблицы DesignPilot уже были созданы вручную или через старую baseline migration, но Prisma не видит baseline как применённую, `npm run db:migrate` может упасть с ошибкой вида:

```text
ERROR: relation "Project" already exists
```

Это означает: данные в базе есть, но в `_prisma_migrations` нет записи о baseline. Базу удалять нельзя. Безопасный порядок:

```bash
npm run db:inspect
npm run db:resolve-baseline
npm run db:migrate
npm run db:assign-owner
```

Что делает этот сценарий:

- `db:inspect` показывает существующие таблицы, колонку `Project.userId` и записи `_prisma_migrations`;
- `db:resolve-baseline` помечает `20260629150000_postgresql_baseline` как уже применённую без выполнения SQL baseline;
- `db:migrate` применяет только следующие миграции, включая Auth.js таблицы;
- `db:assign-owner` привязывает старые проекты без `userId` к пользователю из `INITIAL_ADMIN_EMAIL`.

Перед запуском убедитесь, что `DATABASE_URL` указывает на production PostgreSQL, а не на SQLite/local файл.

## Локальная разработка

```bash
npm run dev
```

## Проверки

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

Для проверки миграций нужен настоящий PostgreSQL `DATABASE_URL`:

```bash
npm run db:migrate
```

## Первый deploy через GitHub и Vercel

1. Отправьте проект в GitHub. `.env`, `node_modules`, `.next` и локальные `.db` файлы коммитить нельзя.
2. Создайте PostgreSQL базу в Neon или Supabase.
3. Локально или в CI один раз примените миграции:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   ```

4. В Vercel импортируйте GitHub-репозиторий DesignPilot.
5. Framework Preset должен определиться как **Next.js**.
6. Добавьте Environment Variables из раздела выше.
7. Нажмите **Deploy**.
8. После изменения env переменных делайте Redeploy.

## История миграций

Старые SQLite migrations несовместимы с PostgreSQL и заменены production baseline:

```text
prisma/migrations/20260629150000_postgresql_baseline
```

Авторизация добавляется миграцией:

```text
prisma/migrations/20260630120000_auth_user_isolation
```

Project Asset Library добавляется миграцией:

```text
prisma/migrations/20260701130000_project_assets
```

Для production используется PostgreSQL migration history. Старый локальный SQLite-файл автоматически не переносится.
