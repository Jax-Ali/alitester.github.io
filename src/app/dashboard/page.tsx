'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { quizService } from '@/services/quiz.service';
import { Header } from '@/components/layout/Header';
import { QuizCard } from '@/components/quiz/QuizCard';
import type { QuizRow } from '@/types/database';
import { ru } from '@/lib/i18n/ru';

export default function DashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setUserEmail(user.email || '');
      quizService.getByUser(user.id).then((data) => {
        setQuizzes(data);
        setLoading(false);
      });
    });
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{ru.loading}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold">{ru.myQuizzes}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{userEmail}</p>
          </div>
          <Link
            href="/create"
            className="text-sm px-4 py-2 bg-white text-zinc-900 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            {ru.newQuiz}
          </Link>
        </div>

        {quizzes.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-xl">
            <p className="text-zinc-500 text-sm">{ru.noQuizzesYet}</p>
            <Link
              href="/create"
              className="inline-block mt-4 text-sm text-zinc-300 hover:text-white underline-offset-2 hover:underline transition-colors"
            >
              {ru.createFirstQuiz}
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
