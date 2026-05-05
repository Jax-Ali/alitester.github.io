'use client';

import { useState, useCallback } from 'react';
import type { QuestionRow } from '@/types';

interface QuestionPlayerProps {
  questions: QuestionRow[];
  onComplete: (answers: Record<string, string[]>) => void;
}

export function QuestionPlayer({ questions, onComplete }: QuestionPlayerProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [checked, setChecked] = useState(false);

  const question = questions[index];
  const isMultiple = question.correct_answers.length > 1;
  const isLast = index === questions.length - 1;

  const toggleOption = useCallback((opt: string) => {
    if (checked) return;
    setSelected((prev) =>
      isMultiple
        ? prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
        : [opt]
    );
  }, [checked, isMultiple]);

  const handleCheck = () => setChecked(true);

  const handleNext = () => {
    const nextAnswers = { ...answers, [question.id]: selected };
    if (isLast) {
      onComplete(nextAnswers);
    } else {
      setAnswers(nextAnswers);
      setSelected([]);
      setChecked(false);
      setIndex((i) => i + 1);
    }
  };

  const getOptionStyle = (opt: string) => {
    const base =
      'w-full text-left p-6 sm:p-8 rounded-2xl border-2 text-base sm:text-lg font-medium transition-all duration-200 shadow-sm';

    if (!checked) {
      return `${base} ${
        selected.includes(opt)
          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-100 shadow-indigo-500/10 scale-[1.02] shadow-xl'
          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] hover:shadow-lg'
      }`;
    }

    const isCorrect = question.correct_answers.includes(opt);
    const isSelected = selected.includes(opt);

    if (isCorrect)
      return `${base} border-emerald-500 bg-emerald-500/20 text-emerald-100 shadow-emerald-500/10 shadow-lg scale-[1.02]`;
    if (isSelected && !isCorrect)
      return `${base} border-red-500 bg-red-500/20 text-red-100 shadow-red-500/10 shadow-lg scale-[1.02]`;
    return `${base} border-white/5 bg-white/[0.02] text-zinc-600 opacity-50`;
  };

  return (
    <div className="w-full flex flex-col gap-10 sm:gap-14">
      {/* Progress */}
      <div className="flex items-center gap-4 max-w-lg mx-auto w-full">
        <span className="text-sm font-semibold text-zinc-500 shrink-0 w-8 text-right">
          {index + 1}
        </span>
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-zinc-500 shrink-0 w-8">
          {questions.length}
        </span>
      </div>

      {/* Question */}
      <div className="text-center px-4 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-4">
          <p className="text-sm font-semibold text-indigo-400 uppercase tracking-widest">
            {isMultiple ? 'Select multiple answers' : 'Select one answer'}
          </p>
          <div 
            className="flex items-center gap-1"
            title="Количество правильных ответов"
          >
            {Array.from({ length: question.correct_answers.length }).map((_, i) => (
              <span key={i} className="text-emerald-400 text-xs leading-none">●</span>
            ))}
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-relaxed md:leading-relaxed mx-auto max-w-3xl">
          {question.text}
        </h2>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-4xl mx-auto">
        {question.options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggleOption(opt)}
            className={getOptionStyle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Feedback & Actions */}
      <div className="w-full max-w-lg mx-auto flex flex-col gap-6 items-center">
        {checked && (
          <div className={`text-center px-6 py-4 rounded-2xl w-full font-medium ${
            question.correct_answers.every((a) => selected.includes(a)) &&
            selected.length === question.correct_answers.length
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {question.correct_answers.every((a) => selected.includes(a)) &&
            selected.length === question.correct_answers.length
              ? '✨ Fantastic! Correct answer.'
              : `Ой! Правильный ответ: ${question.correct_answers.join(', ')}`}
          </div>
        )}

        <div className="w-full flex gap-4">
          {!checked ? (
            <button
              onClick={handleCheck}
              disabled={selected.length === 0}
              className="w-full flex items-center justify-center text-base py-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center text-base py-4 rounded-xl font-bold bg-white text-zinc-900 hover:bg-zinc-200 transition-colors shadow-lg shadow-white/10"
            >
              {isLast ? 'Finish Quiz 🎉' : 'Next Question →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
