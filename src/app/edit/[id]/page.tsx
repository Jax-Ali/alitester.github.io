'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseQuizText } from '@/utils/quizParser';
import { quizService } from '@/services/quiz.service';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { ru } from '@/lib/i18n/ru';
import type { QuizRow, QuestionRow } from '@/types';

const CHATGPT_PROMPT = `Преобразуй следующий текст теста в строгий формат:

Требования:
- Каждый вопрос начинается с "Q:"
- Варианты ответов начинаются с "A:"
- Варианты разделяются символом "|"
- В некоторых вопросах должно быть несколько правильных ответов (2–3)
- Правильные ответы указываются через "C:"
- Если несколько правильных ответов — перечисли их строго через символ "|" (а не через запятую)
- Между вопросами должен быть пустой строкой
- Это все обьязательные требования!!!
Пример:

Q: Вопрос
A: вариант1 | вариант2 | вариант3 | вариант4 | вариант5
C: вариант1 | вариант3

Теперь преобразуй следующий текст:

"`;

interface EditClientProps {
  quiz: QuizRow;
  questions: QuestionRow[];
}

function EditClient({ quiz, questions }: EditClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(quiz.title);
  
  // Reconstruct the text format from the DB questions
  const initialText = questions.map(q => 
    `Q: ${q.text}\nA: ${q.options.join(' | ')}\nC: ${q.correct_answers.join(' | ')}`
  ).join('\n\n');

  const [text, setText] = useState(initialText);
  const [errors, setErrors] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(CHATGPT_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdate = () => {
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
      setErrors(['Не найдено ни одного правильного вопроса.']);
      return;
    }
    setErrors([]);

    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      // Update quiz title
      await quizService.update(quiz.id, {
        title: title.trim(),
      });

      // Delete old questions
      await quizService.deleteQuestions(quiz.id);

      // Insert new questions
      await quizService.createQuestions(
        result.questions.map((q, i) => ({
          quiz_id: quiz.id,
          text: q.text,
          options: q.options,
          correct_answers: q.correct_answers,
          order: i,
        }))
      );

      router.push(`/dashboard`);
    });
  };

  const textareaClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 font-mono resize-none transition-colors';

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{ru.editQuizTitle}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {ru.createQuizDesc}
        </p>
      </div>

      {/* AI Prompt Guide */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-indigo-400 mb-1">📌 Как преобразовать тест:</h2>
          <ol className="text-xs text-zinc-400 list-decimal list-inside space-y-1">
            <li>Скопируйте этот промпт</li>
            <li>Вставьте его в ChatGPT</li>
            <li>Вставьте ваш тест внутрь кавычек ""</li>
            <li>Получите готовый формат</li>
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
          value={text}
          onChange={(e) => { setText(e.target.value); setErrors([]); }}
          className={textareaClass}
        />

        {errors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-400 font-medium mb-2">Исправьте следующие ошибки:</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-red-400">{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={() => router.back()} variant="ghost">
            {ru.cancel}
          </Button>
          <Button
            onClick={handleUpdate}
            loading={isPending}
            disabled={!text.trim() || !title.trim()}
            className="flex-1"
          >
            {ru.editQuiz}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page component (Server → Client) ─────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditPageWrapper(props: PageProps) {
  return <EditPageLoader {...props} />;
}

function EditPageLoader({ params }: PageProps) {
  const [data, setData] = useState<{ quiz: QuizRow; questions: QuestionRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { id } = await params;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/auth?redirect=/edit/${id}`;
        return;
      }

      const [quiz, questions] = await Promise.all([
        quizService.getById(id),
        quizService.getQuestions(id),
      ]);

      if (!quiz) { setError(ru.quizNotFound); return; }
      if (quiz.created_by !== user.id) { setError("У вас нет прав на редактирование этого теста."); return; }

      setData({ quiz, questions });
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

  return <EditClient {...data} />;
}
