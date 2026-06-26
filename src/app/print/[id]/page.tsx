'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { quizService } from '@/services/quiz.service';
import type { QuizRow, QuestionRow } from '@/types';
import { use } from 'react';

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

export default function PrintPage(props: PrintPageProps) {
  const params = use(props.params);
  const [data, setData] = useState<{ quiz: QuizRow; questions: QuestionRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/auth?redirect=/print/${params.id}`;
        return;
      }

      const [quiz, questions] = await Promise.all([
        quizService.getById(params.id),
        quizService.getQuestions(params.id),
      ]);

      if (!quiz) {
        setError('Тест не найден');
        return;
      }

      setData({ quiz, questions });
    })().catch((err) => setError(err.message));
  }, [params.id]);

  if (error) {
    return <div className="p-8 text-black bg-white min-h-screen">{error}</div>;
  }

  if (!data) {
    return <div className="p-8 text-black bg-white min-h-screen">Загрузка...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 sm:p-8 font-serif print:p-0">
      <div className="max-w-4xl mx-auto">
        {/* Controls (Not visible on print) */}
        <div className="print:hidden mb-8 flex flex-col sm:flex-row items-center justify-between border-b border-zinc-200 pb-4 gap-4">
          <div className="flex gap-4">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Распечатать / Сохранить PDF
            </button>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-zinc-200 text-black font-medium rounded hover:bg-zinc-300 transition-colors"
            >
              Закрыть
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none bg-zinc-100 px-4 py-2 rounded-lg border border-zinc-200">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
            <span className="font-medium">Показать правильные ответы</span>
          </label>
        </div>

        {/* Print Content */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center">{data.quiz.title}</h1>
          <div className="flex flex-wrap justify-between items-end mb-8 text-lg border-b-2 border-black pb-4 gap-4">
            <div className="flex-1 min-w-[250px]">ФИО: <div className="border-b border-black w-full inline-block"></div></div>
            <div className="w-[150px]">Дата: <div className="border-b border-black w-full inline-block"></div></div>
            <div className="w-[100px]">Оценка: <div className="border-b border-black w-full inline-block"></div></div>
          </div>

          <div className="flex flex-col gap-8">
            {data.questions.map((q, i) => (
              <div key={q.id} className="break-inside-avoid">
                <h3 className="text-lg font-bold mb-3">
                  {i + 1}. {q.text}
                </h3>
                <div className="flex flex-col gap-2 ml-4">
                  {q.options.map((opt, optIndex) => {
                    const isCorrect = showAnswers && q.correct_answers.includes(opt);
                    return (
                      <div key={optIndex} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 border-2 border-black flex items-center justify-center mt-0.5 relative">
                          {isCorrect && (
                            <div className="absolute inset-0.5 bg-black" />
                          )}
                        </div>
                        <span className={`text-base ${isCorrect ? 'font-bold' : ''}`}>
                          {opt}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
