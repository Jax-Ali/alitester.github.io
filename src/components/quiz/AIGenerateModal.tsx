'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import type { ParsedQuestion } from '@/types';

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsGenerated: (questions: ParsedQuestion[], topic?: string) => void;
  existingQuestions?: string[];
  initialTopic?: string;
}

export function AIGenerateModal({
  isOpen,
  onClose,
  onQuestionsGenerated,
  existingQuestions = [],
  initialTopic = '',
}: AIGenerateModalProps) {
  const [topic, setTopic] = useState(initialTopic);
  const [sourceText, setSourceText] = useState('');
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && !sourceText.trim()) {
      setError('Пожалуйста, укажите тему теста или вставьте учебный материал');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        throw new Error('Сессия не найдена. Пожалуйста, выполните вход в систему.');
      }

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: topic.trim(),
          sourceText: sourceText.trim(),
          count,
          difficulty,
          allowMultiple,
          existingQuestions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при генерации вопросов');
      }

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        onQuestionsGenerated(data.questions, topic.trim());
        onClose();
      } else {
        throw new Error('ИИ не смог сформировать вопросы. Попробуйте уточнить запрос.');
      }
    } catch (err: any) {
      setError(err.message || 'Произошла непредвиденная ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>✨</span>
              <span>Генератор вопросов с ИИ</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Задайте тему или вставьте текст конспекта, и Gemini создаст готовые вопросы для теста.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-4">
          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ai-gen-topic" className="text-xs font-medium text-zinc-300">
              Тема теста <span className="text-zinc-500 font-normal">(или предмет)</span>
            </label>
            <input
              id="ai-gen-topic"
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setError(null);
              }}
              placeholder="Например: Модель OSI или История древнего мира"
              className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Source Material */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ai-gen-source" className="text-xs font-medium text-zinc-300">
              Учебный материал <span className="text-zinc-500 font-normal">(необязательно)</span>
            </label>
            <textarea
              id="ai-gen-source"
              rows={5}
              value={sourceText}
              onChange={(e) => {
                setSourceText(e.target.value);
                setError(null);
              }}
              placeholder="Вставьте лекцию, параграф учебника или тезисы для точной генерации по материалу..."
              className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-y transition-colors"
            />
          </div>

          {/* Options grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ai-gen-count" className="text-xs font-medium text-zinc-300">
                Количество вопросов
              </label>
              <select
                id="ai-gen-count"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value={3}>3 вопроса</option>
                <option value={5}>5 вопросов</option>
                <option value={10}>10 вопросов</option>
                <option value={15}>15 вопросов</option>
                <option value={20}>20 вопросов</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ai-gen-diff" className="text-xs font-medium text-zinc-300">
                Сложность
              </label>
              <select
                id="ai-gen-diff"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="easy">Простой</option>
                <option value="medium">Средний</option>
                <option value="hard">Сложный</option>
              </select>
            </div>
          </div>

          {/* Allow multiple correct answers */}
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-black text-indigo-500 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-zinc-300">
              Разрешить вопросы с несколькими правильными ответами
            </span>
          </label>

          {/* Error alert */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} variant="ghost" className="flex-1" disabled={isLoading}>
              Отмена
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {isLoading ? 'Генерация...' : '✨ Сгенерировать'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
