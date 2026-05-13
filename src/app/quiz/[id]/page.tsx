'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionPlayer } from '@/components/quiz/QuestionPlayer';
import { quizService } from '@/services/quiz.service';
import { attemptService } from '@/services/attempt.service';
import { supabase } from '@/lib/supabase';
import type { QuizRow, QuestionRow } from '@/types';
import { ru } from '@/lib/i18n/ru';

interface QuizClientProps {
  quiz: QuizRow;
  questions: QuestionRow[];
  retryIds?: string[];
}

export function QuizClient({ quiz, questions, retryIds }: QuizClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activeQuestions = retryIds
    ? questions.filter((q) => retryIds.includes(q.id))
    : questions;

  const handleComplete = (answers: Record<string, string[]>) => {
    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const { score, wrongIds } = attemptService.calculateScore(answers, activeQuestions);

      const attempt = await attemptService.create({
        user_id: user.id,
        quiz_id: quiz.id,
        score,
        wrong_questions: wrongIds,
        answers,
      });

      router.push(`/result/${attempt.id}`);
    });
  };

  if (activeQuestions.length === 0) {
    return (
      <div className="text-center text-zinc-500 text-sm py-20">
        {ru.noQuestions}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 py-16 sm:p-6 sm:py-6 min-h-screen relative bg-gradient-to-br from-zinc-900 via-black to-zinc-950">
      <button
        onClick={() => {
          if (window.confirm(ru.confirmExit)) {
            router.push('/dashboard');
          }
        }}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 text-sm text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg flex items-center gap-2 backdrop-blur-sm"
      >
        ← {ru.back}
      </button>

      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-4 sm:gap-8 mt-2 sm:mt-0">
        <div className="w-full text-center">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-2">{quiz.title}</p>
          {retryIds && (
            <span className="inline-block px-3 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/20">
              {ru.retryWrong(activeQuestions.length)}
            </span>
          )}
        </div>
        
        <QuestionPlayer questions={activeQuestions} onComplete={handleComplete} />
        
        {isPending && (
          <p className="mt-4 text-sm text-zinc-500 animate-pulse text-center">{ru.savingResult}</p>
        )}
      </div>
    </div>
  );
}

// ─── Page component (Server → Client) ─────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retry?: string }>;
}

export default function QuizPageWrapper(props: PageProps) {
  return <QuizPageLoader {...props} />;
}

function QuizPageLoader({ params, searchParams }: PageProps) {
  const [data, setData] = useState<{ quiz: QuizRow; questions: QuestionRow[]; retryIds?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { id } = await params;
      const { retry } = await searchParams;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/auth?redirect=/quiz/${id}`;
        return;
      }

      const [quiz, questions] = await Promise.all([
        quizService.getById(id),
        quizService.getQuestions(id),
      ]);

      if (!quiz) { setError(ru.quizNotFound); return; }

      const retryIds = retry ? retry.split(',') : undefined;
      setData({ quiz, questions, retryIds });
    })().catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return <QuizClient {...data} />;
}
