# AI Flashcard Generator

Turn any text or PDF into AI-generated flashcards, then study with spaced repetition.

This project uses Next.js, Supabase, and OpenRouter.

## Features

- Text-to-flashcard generation with model fallback
- PDF text extraction and generation flow
- Saved decks after signing up

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Supabase (Auth + Postgres)
- OpenRouter (via OpenAI-compatible SDK)
- Zod validation
- Vitest tests

## Project Structure

```text
app/                  App router pages and API routes
components/           UI components
lib/                  Shared logic (OpenRouter, SM-2, rate limiting)
supabase/migrations/  SQL schema
types/                TypeScript models
__tests__/            Route and logic tests
```

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project
- OpenRouter API key

## 1) Local Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with your real values.

Run the migration SQL in your Supabase SQL editor:

```text
supabase/migrations/001_initial_schema.sql
```

Start development:

```bash
npm run dev
```

For the original Turbopack mode:

```bash
npm run dev:turbo
```

## 2) Required Environment Variables

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_APP_URL`

Optional:

- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

## 3) Supabase Auth Configuration

In Supabase Dashboard:

- Enable magic link/email auth
- Set site URL to your app URL
- Set redirect URL to `/auth/callback`

Examples:

- Local: `http://localhost:3000`
- Local callback: `http://localhost:3000/auth/callback`

## 4) API Endpoints

- `POST /api/generate` generate cards from text
- `POST /api/parse-pdf` extract text from PDF
- `GET|POST /api/decks` list and create decks
- `GET|PATCH|DELETE /api/decks/[id]` manage single deck
- `PATCH /api/cards/[id]` update card
- `POST /api/study` submit study rating
- `GET /api/health` environment health status

## 5) Vercel Deployment

1. Push this project to GitHub.
2. Import repository in Vercel.
3. Framework preset: Next.js.
4. Add all environment variables in Vercel project settings.
5. Deploy.

After deploy, update Supabase auth URLs:

- Site URL: your production domain
- Redirect URL: `https://YOUR_DOMAIN/auth/callback`

## 6) Verify Deployment

1. Open home page and generate cards from text.
2. Upload a PDF and confirm extraction works.
3. Sign in via magic link.
4. Save a deck, open dashboard, and start a study session.

## 7) Quality Checks

```bash
npm run test
npm run lint
npm run type-check
npm run build
```

Or all-in-one:

```bash
npm run verify
```

## Notes

- Keep `OPENROUTER_API_KEY` server-side only.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- OpenRouter requests require a valid app URL for referer header usage.
