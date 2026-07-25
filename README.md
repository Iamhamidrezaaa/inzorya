# Inzorya

**AI Marketing Operating System**

Inzorya is a workspace-first marketing OS — closer to Notion, Linear, Stripe Dashboard, Cursor, and Vercel than to social schedulers.

## Status

**EPIC-003 — Social Channels + Business Brain**

- Business onboarding wizard (save / resume / finish)
- Business profile page
- Channels foundation: Instagram, Facebook, WhatsApp, Telegram, LinkedIn, X, YouTube, TikTok
- Mock connect/disconnect with permissions + last sync (OAuth-ready models)
- Home shows business completion, channels, knowledge, drafts, conversations

No Meta API. No OAuth. No webhooks. No AI.

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
