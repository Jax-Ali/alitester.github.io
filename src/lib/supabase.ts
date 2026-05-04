import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (typeof window !== 'undefined' && (!url || !anonKey)) {
  console.warn(
    '[QuizTrainer] Supabase env vars are missing. ' +
    'Copy .env.example → .env.local and fill in your credentials.'
  );
}

export const supabase = createClient<Database>(url, anonKey);
