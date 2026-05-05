-- ─── users table (mirrors auth.users) ────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.users enable row level security;

-- Users can view all users (needed for simple admin check without recursion)
create policy "Anyone can view users"
  on public.users for select using (true);

-- Function and trigger to auto-create public.user
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Populate existing users
insert into public.users (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ─── Update RLS for quizzes to allow admins ───────────────────
drop policy if exists "Users can view own quizzes" on public.quizzes;
create policy "Users can view own quizzes or admin views all"
  on public.quizzes for select using (
    auth.uid() = created_by OR
    (select is_admin from public.users where id = auth.uid()) = true
  );
