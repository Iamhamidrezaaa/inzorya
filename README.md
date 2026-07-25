# Inzorya

**AI Marketing Operating System**

Inzorya is a workspace-first marketing OS — closer to Notion, Linear, Stripe Dashboard, Cursor, and Vercel than to social schedulers.

## Status

EPIC-001 foundation is implemented:

- Next.js App Router shell
- Auth (login, register, forgot password)
- Dashboard shell (sidebar, top bar, command palette, notifications)
- Brand onboarding
- All architecture routes with empty / loading / error states
- Minimal landing page

No AI logic. No marketing feature business logic. No fake charts.

## Stack

- Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui
- React Query · Prisma · PostgreSQL · NextAuth (Auth.js)
- Framer Motion (available) · Lucide · Zustand

## Local setup

1. Copy env:

```bash
cp .env.example .env
```

2. Start Postgres (mapped to host port **5433** to avoid local conflicts):

```bash
docker compose up -d
```

3. Install and migrate:

```bash
npm install --legacy-peer-deps
npx prisma db push
npm run dev
```

`DATABASE_URL` in `.env.example` already uses `localhost:5433`.

4. Open [http://localhost:3000](http://localhost:3000)

## Architecture

See [`docs/architecture/dashboard-architecture.md`](./docs/architecture/dashboard-architecture.md).

## Remote

https://github.com/Iamhamidrezaaa/inzorya
