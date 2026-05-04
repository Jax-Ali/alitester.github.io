-- ============================================================
-- Quiz Trainer MVP — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── quizzes ─────────────────────────────────────────────────
create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now() not null
);

-- ─── questions ───────────────────────────────────────────────
create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes(id) on delete cascade,
  text            text not null,
  options         jsonb not null,        -- string[]
  correct_answers jsonb not null,        -- string[]
  "order"         int default 0 not null
);

-- ─── attempts ────────────────────────────────────────────────
create table if not exists public.attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  quiz_id         uuid not null references public.quizzes(id) on delete cascade,
  score           int default 0 not null,              -- 0–100
  wrong_questions jsonb default '[]'::jsonb not null,  -- string[] of question IDs
  answers         jsonb default '{}'::jsonb not null,  -- { [questionId]: string[] }
  completed_at    timestamptz default now() not null
);

-- ─── Row Level Security ───────────────────────────────────────
alter table public.quizzes   enable row level security;
alter table public.questions enable row level security;
alter table public.attempts  enable row level security;

-- quizzes: user manages their own
create policy "Users can view own quizzes"
  on public.quizzes for select using (auth.uid() = created_by);
create policy "Users can insert own quizzes"
  on public.quizzes for insert with check (auth.uid() = created_by);
create policy "Users can delete own quizzes"
  on public.quizzes for delete using (auth.uid() = created_by);

-- questions: accessible if creator owns the quiz
create policy "Quiz creator can manage questions"
  on public.questions for all
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = questions.quiz_id
        and quizzes.created_by = auth.uid()
    )
  );

-- attempts: user manages their own
create policy "Users can view own attempts"
  on public.attempts for select using (auth.uid() = user_id);
create policy "Users can insert own attempts"
  on public.attempts for insert with check (auth.uid() = user_id);
