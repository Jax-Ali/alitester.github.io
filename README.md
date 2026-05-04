# Quiz Trainer

A full-stack web application for generating, taking, and tracking quizzes. Built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| CI/CD | GitHub Actions |

## Project Architecture

```
src/
├── app/             # Next.js App Router: pages, layouts, routes
├── components/      # Reusable UI components (grouped by domain)
│   └── layout/      # Header, MainContainer, etc.
├── lib/             # External client configs (Supabase, etc.)
│   └── supabase/
│       └── client.ts
├── services/        # Business logic & DB interaction layer
│   ├── auth.service.ts
│   └── quiz.service.ts
└── types/           # Shared TypeScript interfaces & types
    └── index.ts
```

**Design principles:**
- Components contain **only UI logic** — no direct DB calls.
- Services encapsulate **all business logic** — easy to test and swap.
- Types are **centralized** — one source of truth.
- No hardcoded values — everything goes through **env variables**.

---

## Getting Started (Local Development)

### 1. Prerequisites

- **Node.js** v18+
- **npm** v9+
- A **Supabase** project (free tier works)

### 2. Clone & Install

```bash
git clone https://github.com/<your-username>/alitestor_ohshit.git
cd alitestor_ohshit
npm install
```

### 3. Configure Supabase

> Get your keys from [Supabase Dashboard](https://supabase.com/dashboard) → Project → Settings → API.

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Connecting Supabase

### Database Tables (Required Schema)

Run the following SQL in your Supabase SQL Editor to initialize the schema:

```sql
-- Users are managed by Supabase Auth automatically.

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  creator_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade not null,
  content text not null,
  type text not null, -- 'multiple_choice' | 'single_choice' | 'text'
  options jsonb,
  correct_answer jsonb not null,
  "order" int default 0
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  score numeric not null default 0,
  started_at timestamptz default now(),
  completed_at timestamptz
);
```

---

## Deploying via GitHub

### Option A: Vercel (Recommended)

1. Push your project to a **GitHub repository**.
2. Go to [vercel.com](https://vercel.com) and import the repo.
3. In the Vercel project settings, add your **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Every push to `main` will automatically trigger a new deployment.

### Option B: Manual (via GitHub Actions)

The CI pipeline in `.github/workflows/ci.yml` automatically runs on every push:
- **Installs** dependencies
- **Lints** code (`npm run lint`)
- **Type-checks** TypeScript (`tsc --noEmit`)
- **Builds** the project (`npm run build`)

If any step fails, the PR/push is blocked — keeping `main` always deployable.

---

## Contributing & Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/my-feature

# 2. Make changes, then commit
git add .
git commit -m "feat: add my feature"

# 3. Push and open a Pull Request
git push origin feature/my-feature
```

CI checks run automatically on your PR. Merge only when all checks pass.
