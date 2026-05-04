'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { authService } from '@/services/auth.service';

export function Header() {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await authService.signOut();
      window.location.href = '/auth';
    });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-white tracking-tight hover:text-zinc-300 transition-colors"
        >
          Quiz Trainer
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/create"
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            + New quiz
          </Link>
          <button
            onClick={handleSignOut}
            disabled={isPending}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
