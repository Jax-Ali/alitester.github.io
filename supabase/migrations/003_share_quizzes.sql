-- ============================================================
-- Quiz Trainer — Migration 003: Share Quizzes
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Drop existing SELECT policy for quizzes
drop policy if exists "Users can view own quizzes or admin views all" on public.quizzes;
drop policy if exists "Users can view own quizzes" on public.quizzes;

-- 2. Create new policy: Any authenticated user can view any quiz
-- Since quizzes have unguessable UUIDs, simply knowing the ID (having the link) is enough security.
create policy "Anyone authenticated can view quizzes"
  on public.quizzes for select
  using (auth.role() = 'authenticated');

-- 3. Drop existing SELECT policy for questions
drop policy if exists "Quiz creator can manage questions" on public.questions;

-- 4. Create new policies for questions:
-- 4a. Any authenticated user can view questions (to pass the quiz)
create policy "Anyone authenticated can view questions"
  on public.questions for select
  using (auth.role() = 'authenticated');

-- 4b. Quiz creator can still insert/update/delete their own questions
create policy "Quiz creator can insert questions"
  on public.questions for insert
  with check (
    exists (
      select 1 from public.quizzes
      where quizzes.id = quiz_id
        and quizzes.created_by = auth.uid()
    )
  );

create policy "Quiz creator can update questions"
  on public.questions for update
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = quiz_id
        and quizzes.created_by = auth.uid()
    )
  );

create policy "Quiz creator can delete questions"
  on public.questions for delete
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = quiz_id
        and quizzes.created_by = auth.uid()
    )
  );
