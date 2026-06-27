# EDUS AI — Design Prompt Builder

MVP-сервис для подготовки контекста мобильного приложения перед генерацией Design Spec и промптов.

## Запуск

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Данные хранятся локально в SQLite (`prisma/dev.db`). Авторизация в MVP не подключена.

## OpenRouter

Добавьте локальный ключ и модель в `.env`:

```env
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_MODEL="openai/gpt-4o-mini"
```

Проверить подключение можно на [http://localhost:3000/settings/openrouter](http://localhost:3000/settings/openrouter).

## Design Intelligence Engine

Внутри проекта доступны разделы Decisions и AI Logs. Generate/Edit сохраняют prompt log и proposed design decisions, а Approve создаёт Screen Summary для утверждённой версии. Перед AI-вызовом используйте **Preview Context**, чтобы увидеть собранный context и raw JSON.
