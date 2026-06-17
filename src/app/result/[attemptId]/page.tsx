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

      {/* Full Test Review */}
      <div className="flex flex-col gap-6 mt-4 border-t border-white/10 pt-8">
        <h2 className="text-lg font-semibold text-white">{ru.allAnswers}</h2>
        <div className="flex flex-col gap-8">
          {questions.map((q, i) => {
            const userAnswer = attempt.answers?.[q.id] ?? [];
            const isFullyCorrect = 
              userAnswer.length === q.correct_answers.length && 
              q.correct_answers.every(a => userAnswer.includes(a));

            return (
              <div key={q.id} className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    isFullyCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {i + 1}
                  </span>
                  <h3 className="text-base text-white font-medium leading-snug">{q.text}</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                  {q.options.map((opt) => {
                    const isCorrect = q.correct_answers.includes(opt);
                    const isSelected = userAnswer.includes(opt);
                    
                    let style = "border-white/5 bg-white/[0.02] text-zinc-500";
                    let icon = null;
                    
                    if (isCorrect && isSelected) {
                      style = "border-emerald-500 bg-emerald-500/10 text-emerald-400";
                      icon = "✓";
                    } else if (!isCorrect && isSelected) {
                      style = "border-red-500 bg-red-500/10 text-red-400";
                      icon = "✕";
                    } else if (isCorrect && !isSelected) {
                      style = "border-emerald-500/50 bg-transparent text-emerald-500";
                      icon = "✓";
                    }

                    return (
                      <div key={opt} className={`px-3 py-2.5 rounded-lg border text-sm flex items-start gap-2.5 ${style}`}>
                        <div className={`shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected ? 'border-current bg-current text-zinc-950' : 'border-current/50'
                        }`}>
                          {icon && <span className="text-[10px] font-bold leading-none">{icon}</span>}
                        </div>
                        <span className="leading-snug">{opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
