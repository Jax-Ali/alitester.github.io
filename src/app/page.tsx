import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default async function RootPage() {
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? '/dashboard' : '/auth');
}
