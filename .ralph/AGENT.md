# Ralph Agent Configuration

Проект ещё не проинициализирован — команды ниже начинают работать после того,
как будет выполнен первый пункт fix_plan.md (скелет Next.js).
**Обнови этот файл сразу после создания скелета и при каждом изменении сборки.**

## Build Instructions

```bash
npm install
npx prisma generate
npm run build
```

## Test Instructions

```bash
npm test
```

## Run Instructions

```bash
# Локальная разработка (нужна поднятая база)
docker compose up -d postgres
npx prisma migrate dev
npm run dev            # http://localhost:3000

# Полный стек
docker compose up --build
```

## Notes
- Стек: Next.js (App Router, TypeScript) + Prisma + PostgreSQL, всё в Docker.
- Контейнеры: `web` (Next.js :3000), `worker` (Telegram-бот + ежедневный планировщик),
  `postgres` (:5432), `nginx` (TLS, rate-limit, CSP, отдача `/media`).
- Переменные окружения — в `.env` по образцу `.env.example`; секреты в репозиторий не попадают.
  Ключевые: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_IDS`, `JWT_SECRET`.
- Миграции: `npx prisma migrate dev` локально, `npx prisma migrate deploy` в проде.
- Update this file when build process changes
