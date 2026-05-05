'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parseQuizText } from '@/utils/quizParser';
import { quizService } from '@/services/quiz.service';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';

const EXAMPLE = `Q: What is the capital of France?
A: Berlin | Paris | Rome | Madrid
C: Paris

Q: Which of these are prime numbers?
A: 2 | 4 | 7 | 9
C: 2, 7

Q: What does HTML stand for?
A: HyperText Markup Language | High Text Machine Language | HyperText Machine Language | HyperText Markup Level
C: HyperText Markup Language`;

export default function CreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!title.trim()) {
      setErrors(['Название теста обязательно.']);
      return;
    }

    const result = parseQuizText(text);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    if (result.questions.length === 0) {
      setErrors(['No valid questions found.']);
      return;
    }
    setErrors([]);

    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const quiz = await quizService.create({
        title: title.trim(),
        created_by: user.id,
      });

      await quizService.createQuestions(
        result.questions.map((q, i) => ({
          quiz_id: quiz.id,
          text: q.text,
          options: q.options,
          correct_answers: q.correct_answers,
          order: i,
        }))
      );

      router.push(`/quiz/${quiz.id}`);
    });
  };

  const textareaClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 font-mono resize-none transition-colors';

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Create a quiz</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Paste questions in the format below. Blank line between each question.
        </p>
      </div>

      {/* Format reference */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Format</p>
        <pre className="text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap">
          {`Q: Your question\nA: Option 1 | Option 2 | Option 3 | Option 4\nC: Correct option (exact match)\n\n(blank line between questions)`}
        </pre>
      </div>

      <div className="flex flex-col gap-4">
        <input
          id="quiz-title"
          type="text"
          placeholder="Введите название теста"
          required
          value={title}
          onChange={(e) => { setTitle(e.target.value); setErrors([]); }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
        />

        <textarea
          id="quiz-text"
          rows={16}
          placeholder={EXAMPLE}
          value={text}
          onChange={(e) => { setText(e.target.value); setErrors([]); }}
          className={textareaClass}
        />

        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-400 font-medium mb-2">Fix these errors:</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-red-400">{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={() => router.back()} variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            loading={isPending}
            disabled={!text.trim()}
            className="flex-1"
          >
            Create quiz
          </Button>
        </div>
      </div>
    </div>
  );
}
