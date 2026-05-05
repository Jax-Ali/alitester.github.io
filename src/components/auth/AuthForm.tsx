'use client';

import { useState, useTransition } from 'react';
import { authService } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { ru } from '@/lib/i18n/ru';

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        if (mode === 'login') {
          await authService.signIn(email, password);
          window.location.href = '/dashboard';
        } else {
          await authService.signUp(email, password);
          // If confirm is OFF in Supabase, the user is created instantly.
          setMode('login');
          setSuccess(ru.accountCreated);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : ru.somethingWentWrong);
      }
    });
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors';

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold mb-1">
        {mode === 'login' ? ru.signIn : ru.createAccount}
      </h1>
      <p className="text-zinc-500 text-sm mb-8">
        {mode === 'login'
          ? ru.welcomeBack
          : ru.startTraining}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          id="email"
          type="email"
          placeholder={ru.email}
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          id="password"
          type="password"
          placeholder={ru.password}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            {success}
          </p>
        )}

        <Button type="submit" loading={isPending} className="w-full mt-1">
          {mode === 'login' ? ru.signIn : ru.createAccount}
        </Button>
      </form>

      <p className="text-sm text-zinc-500 mt-6 text-center">
        {mode === 'login' ? ru.noAccount : ru.hasAccount}{' '}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setSuccess(null); }}
          className="text-zinc-300 hover:text-white transition-colors underline-offset-2 hover:underline"
        >
          {mode === 'login' ? ru.register : ru.signIn}
        </button>
      </p>
    </div>
  );
}
