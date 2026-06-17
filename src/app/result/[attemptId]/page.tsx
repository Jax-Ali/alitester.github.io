'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { attemptService } from '@/services/attempt.service';
import { quizService } from '@/services/quiz.service';
import type { AttemptRow, QuestionRow, QuizRow } from '@/types';
import { Button } from '@/components/ui/Button';
import { ru } from '@/lib/i18n/ru';

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

export default function ResultPage({ params }: PageProps) {
  const router = useRouter();
  const [data, setData] = useState<{
    attempt: AttemptRow;
    quiz: QuizRow;
    questions: QuestionRow[];
    wrongQuestions: QuestionRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { attemptId } = await params;
      const attempt = await attemptService.getById(attemptId);
      if (!attempt) { setError(ru.resultNotFound); return; }

      const [quiz, questions] = await Promise.all([
        quizService.getById(attempt.quiz_id),
        quizService.getQuestions(attempt.quiz_id),
      ]);
      if (!quiz) { setError(ru.quizNotFound); return; }

      const wrongQuestions = questions.filter((q) =>
        attempt.wrong_questions.includes(q.id)
      );

      setData({ attempt, quiz, questions, wrongQuestions });
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

  const { attempt, quiz, questions, wrongQuestions } = data;
  const passed = attempt.score >= 70;
  const retryUrl = `/quiz/${quiz.id}?retry=${wrongQuestions.map((q) => q.id).join(',')}`;
  
  // attempt.score is a percentage (0-100). Convert back to raw fractional score.
  const rawScore = Number(((attempt.score / 100) * questions.length).toFixed(2));

  return (
    <div className="min-h-screen max-w-xl mx-auto px-4 py-12 flex flex-col gap-8">
      {/* Score */}
      <div className="text-center">
        <div
          className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold mb-4 border-4 ${
            passed
              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
              : 'border-red-500/40 text-red-400 bg-red-500/10'
          }`}
        >
          {attempt.score}%
        </div>
        <h1 className="text-xl font-semibold">
          {passed ? ru.wellDone : ru.keepPracticing}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {quiz.title} · {ru.correctCount(rawScore, questions.length)}
        </p>
      </div>

      {/* Wrong answers */}
      {wrongQuestions.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-400">{ru.wrongAnswers}</h2>
          {wrongQuestions.map((q) => {
            const userAnswer = attempt.answers?.[q.id] ?? [];
            return (
              <div
                key={q.id}
                className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col gap-2"
              >
                <p className="text-sm text-white">{q.text}</p>
                <div className="text-xs space-y-1">
                  <p className="text-red-400">
                    {ru.yourAnswer} {userAnswer.length > 0 ? userAnswer.join(', ') : '—'}
                  </p>
                  <p className="text-emerald-400">
                    {ru.correctAnswer} {q.correct_answers.join(', ')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {wrongQuestions.length > 0 && (
          <Button onClick={() => router.push(retryUrl)} className="w-full">
            {ru.retryWrongBtn(wrongQuestions.length)}
          </Button>
        )}
        <Button
          onClick={() => router.push(`/quiz/${quiz.id}`)}
          variant="ghost"
          className="w-full"
        >
          {ru.restartFull}
        </Button>
        <Link
          href="/dashboard"
          className="text-sm text-center text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
        >
          ← {ru.backToDashboard}
        </Link>
      </div>
    </div>
  );
}
