'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { QuizRow } from '@/types';
import { ru } from '@/lib/i18n/ru';

interface QuizCardProps {
  quiz: QuizRow;
  questionCount?: number;
}

export function QuizCard({ quiz, questionCount }: QuizCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = `${window.location.origin}/quiz/${quiz.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-white leading-snug line-clamp-2">
          {quiz.title}
        </h3>
        {questionCount !== undefined && (
          <span className="shrink-0 text-xs text-zinc-500 bg-white/5 border border-white/10 rounded-md px-2 py-0.5">
            {questionCount} в.
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-600">
        <p>
          {new Date(quiz.created_at).toLocaleDateString('ru-RU', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <Link
          href={`/edit/${quiz.id}`}
          className="hover:text-white transition-colors"
          title={ru.editButton}
        >
          ✏️
        </Link>
      </div>

      <div className="mt-auto flex gap-2">
        <Link
          href={`/quiz/${quiz.id}`}
          className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
        >
          {ru.startQuiz}
        </Link>
        <button
          onClick={handleCopyLink}
          className={`flex-1 text-center text-xs font-medium py-2 rounded-lg border transition-colors ${
            copied
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {copied ? ru.linkCopied : ru.copyLink}
        </button>
      </div>
    </div>
  );
}
