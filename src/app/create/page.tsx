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

const CHATGPT_PROMPT = `Преобразуй следующий текст теста в строгий формат:

Требования:
- Каждый вопрос начинается с "Q:"
- Варианты ответов начинаются с "A:"
- Варианты разделяются символом "|"
- Правильный ответ указывается через "C:"
- Если несколько правильных ответов — перечисли их через запятую
- Между вопросами должна быть пустая строка

Пример формата:

Q: Вопрос
A: вариант1 | вариант2 | вариант3 | вариант4
C: правильный ответ

Теперь преобразуй следующий текст:

"`;

export default function CreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(CHATGPT_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      {/* AI Prompt Guide */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-indigo-400 mb-1">🤖 Как быстро создать тест через ИИ</h2>
          <ol className="text-xs text-zinc-400 list-decimal list-inside space-y-1">
            <li>Нажми кнопку ниже, чтобы скопировать специальный промпт</li>
            <li>Открой ChatGPT (или любой другой ИИ) и вставь промпт</li>
            <li>Сразу после промпта вставь свой сырой текст/конспект и отправь</li>
            <li>Скопируй результат от ИИ и вставь его в большое поле ниже!</li>
          </ol>
        </div>
        
        <div className="bg-black/40 rounded-lg p-4 relative group">
          <pre className="text-xs text-zinc-500 font-mono whitespace-pre-wrap leading-relaxed">
            {CHATGPT_PROMPT}
          </pre>
          <button
            onClick={handleCopyPrompt}
            className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-white/10 backdrop-blur-md"
          >
            {copied ? '✅ Скопировано!' : '📋 Скопировать промпт'}
          </button>
        </div>
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
