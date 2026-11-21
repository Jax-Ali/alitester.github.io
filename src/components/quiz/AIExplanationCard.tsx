'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ExplanationData {
  why_student_is_wrong: string;
  why_correct_is_right: string;
  rule_to_remember: string;
  example: string;
}

interface AIExplanationCardProps {
  attemptId: string;
  questionId: string;
  cachedExplanation?: ExplanationData;
  onExplanationLoaded: (questionId: string, data: ExplanationData) => void;
}

export function AIExplanationCard({
  attemptId,
  questionId,
  cachedExplanation,
  onExplanationLoaded,
}: AIExplanationCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    // 1. If we already have the explanation, simply toggle visibility (no new network request)
    if (cachedExplanation) {
      setIsOpen((prev) => !prev);
      return;
    }

    // 2. Otherwise, fetch explanation from our secure server endpoint
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        throw new Error('Сессия не найдена. Пожалуйста, войдите в систему.');
      }

      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ attemptId, questionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при получении объяснения');
      }

      if (data.explanation) {
        onExplanationLoaded(questionId, data.explanation);
        setIsOpen(true);
      } else {
        throw new Error('Сервер вернул пустой ответ');
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось получить объяснение');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-2.5 flex flex-col items-start w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
          cachedExplanation && isOpen
            ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/40 shadow-sm'
        }`}
      >
        {isLoading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Анализирую ошибку...</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>
              {cachedExplanation
                ? isOpen
                  ? 'Скрыть объяснение'
                  : 'Показать объяснение'
                : 'Объяснить с ИИ'}
            </span>
          </>
        )}
      </button>

      {/* Error alert with retry */}
      {error && (
        <div className="mt-2 w-full p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleClick}
            className="text-red-200 underline hover:no-underline font-medium shrink-0"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Explanation block */}
      {isOpen && cachedExplanation && (
        <div className="mt-2.5 w-full bg-gradient-to-b from-indigo-950/20 via-zinc-900/40 to-black/40 border border-indigo-500/20 rounded-xl p-4 text-xs flex flex-col gap-3 shadow-inner">
          {/* Section 1: Error breakdown */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-red-400">
              <span>✕</span>
              <span>В чём ошибка:</span>
            </div>
            <p className="text-zinc-300 mt-1 leading-relaxed pl-4">
              {cachedExplanation.why_student_is_wrong}
            </p>
          </div>

          {/* Section 2: Why correct answer is right */}
          <div className="border-t border-white/5 pt-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <span>✓</span>
              <span>Почему правильный ответ верен:</span>
            </div>
            <p className="text-zinc-300 mt-1 leading-relaxed pl-4">
              {cachedExplanation.why_correct_is_right}
            </p>
          </div>

          {/* Section 3: Rule */}
          <div className="border-t border-white/5 pt-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <span>📌</span>
              <span>Правило для запоминания:</span>
            </div>
            <p className="text-zinc-300 mt-1 leading-relaxed pl-4">
              {cachedExplanation.rule_to_remember}
            </p>
          </div>

          {/* Section 4: Example */}
          <div className="border-t border-white/5 pt-2.5">
            <div className="flex items-center gap-1.5 font-semibold text-sky-300">
              <span>💡</span>
              <span>Пример:</span>
            </div>
            <p className="text-zinc-300 mt-1 leading-relaxed pl-4">
              {cachedExplanation.example}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
