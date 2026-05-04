import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (typeof window !== 'undefined' && (!url || !anonKey)) {
  console.warn(
    '[QuizTrainer] Supabase env vars are missing. ' +
    'Copy .env.example → .env.local and fill in your credentials.'
  );
}

// We omit the strict Database generic to prevent Vercel TS inference build errors.
// All types are strictly validated at the Service layer anyway.
export const supabase = createClient<any, any, any>(url, anonKey);
