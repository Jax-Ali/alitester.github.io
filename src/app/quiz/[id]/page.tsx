'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionPlayer } from '@/components/quiz/QuestionPlayer';
import { quizService } from '@/services/quiz.service';
import { attemptService } from '@/services/attempt.service';
import { supabase } from '@/lib/supabase';
import type { QuizRow, QuestionRow } from '@/types';

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
        No questions to show.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start pt-12 px-4 min-h-screen relative">
      <button
        onClick={() => {
          if (window.confirm('Вы уверены, что хотите выйти?')) {
            router.push('/dashboard');
          }
        }}
        className="absolute top-6 left-6 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        ← Exit
      </button>

      <div className="w-full max-w-xl mb-8">
        <h1 className="text-base font-medium text-white">{quiz.title}</h1>
        {retryIds && (
          <p className="text-xs text-zinc-500 mt-0.5">Retrying {activeQuestions.length} wrong answer(s)</p>
        )}
      </div>
      <QuestionPlayer questions={activeQuestions} onComplete={handleComplete} />
      {isPending && (
        <p className="mt-8 text-sm text-zinc-500 animate-pulse">Saving result…</p>
      )}
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

      const [quiz, questions] = await Promise.all([
        quizService.getById(id),
        quizService.getQuestions(id),
      ]);

      if (!quiz) { setError('Quiz not found.'); return; }

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
