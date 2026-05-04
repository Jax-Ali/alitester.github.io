'use client';

import { useState, useCallback } from 'react';
import type { QuestionRow } from '@/types';
import { Button } from '@/components/ui/Button';

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
      'w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors';

    if (!checked) {
      return `${base} ${
        selected.includes(opt)
          ? 'border-white/40 bg-white/10 text-white'
          : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
      }`;
    }

    const isCorrect = question.correct_answers.includes(opt);
    const isSelected = selected.includes(opt);

    if (isCorrect)
      return `${base} border-emerald-500/50 bg-emerald-500/10 text-emerald-300`;
    if (isSelected && !isCorrect)
      return `${base} border-red-500/50 bg-red-500/10 text-red-300`;
    return `${base} border-white/5 bg-white/[0.03] text-zinc-500`;
  };

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/60 rounded-full transition-all duration-300"
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-zinc-500 shrink-0">
          {index + 1} / {questions.length}
        </span>
      </div>

      {/* Question */}
      <div>
        <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">
          {isMultiple ? 'Select all that apply' : 'Select one'}
        </p>
        <h2 className="text-lg font-medium text-white leading-snug">
          {question.text}
        </h2>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
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

      {/* Feedback */}
      {checked && (
        <p className={`text-sm ${
          question.correct_answers.every((a) => selected.includes(a)) &&
          selected.length === question.correct_answers.length
            ? 'text-emerald-400'
            : 'text-red-400'
        }`}>
          {question.correct_answers.every((a) => selected.includes(a)) &&
          selected.length === question.correct_answers.length
            ? '✓ Correct'
            : `✗ Correct: ${question.correct_answers.join(', ')}`}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!checked ? (
          <Button onClick={handleCheck} disabled={selected.length === 0} className="flex-1">
            Check
          </Button>
        ) : (
          <Button onClick={handleNext} className="flex-1">
            {isLast ? 'Finish' : 'Next →'}
          </Button>
        )}
      </div>
    </div>
  );
}
