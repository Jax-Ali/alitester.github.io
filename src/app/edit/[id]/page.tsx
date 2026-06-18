'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseQuizText, ParsedQuestion } from '@/utils/quizParser';
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

interface EditClientProps {
  quiz: QuizRow;
  questions: QuestionRow[];
}

function EditClient({ quiz, questions: initialQuestions }: EditClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(quiz.title);
  
  const [questions, setQuestions] = useState<ParsedQuestion[]>(
    initialQuestions.map(q => ({
      text: q.text,
      options: [...q.options],
      correct_answers: [...q.correct_answers]
    }))
  );

  const [isPending, startTransition] = useTransition();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTextImport, setShowTextImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isAIParsing, setIsAIParsing] = useState(false);

  const toggleCorrectAnswer = (qIndex: number, option: string) => {
    const newQs = [...questions];
    const q = newQs[qIndex];
    if (q.correct_answers.includes(option)) {
      q.correct_answers = q.correct_answers.filter(a => a !== option);
      if (q.correct_answers.length === 0) {
        q.correct_answers = ['[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]'];
      }
    } else {
      q.correct_answers = q.correct_answers.filter(a => a !== '[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]');
      q.correct_answers.push(option);
    }
    setQuestions(newQs);
  };

  const updateQuestionText = (qIndex: number, newText: string) => {
    const newQs = [...questions];
    newQs[qIndex].text = newText;
    setQuestions(newQs);
  };

  const updateOption = (qIndex: number, optIndex: number, newText: string) => {
    const newQs = [...questions];
    const q = newQs[qIndex];
    const oldText = q.options[optIndex];
    
    q.options[optIndex] = newText;
    
    if (q.correct_answers.includes(oldText)) {
      q.correct_answers = q.correct_answers.filter(a => a !== oldText);
      q.correct_answers.push(newText);
    }
    setQuestions(newQs);
  };

  const deleteOption = (qIndex: number, optIndex: number) => {
    const newQs = [...questions];
    const q = newQs[qIndex];
    const removedText = q.options[optIndex];
    
    q.options.splice(optIndex, 1);
    q.correct_answers = q.correct_answers.filter(a => a !== removedText);
    if (q.correct_answers.length === 0) {
      q.correct_answers = ['[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]'];
    }
    setQuestions(newQs);
  };

  const addOption = (qIndex: number) => {
    const newQs = [...questions];
    newQs[qIndex].options.push(`Вариант ${newQs[qIndex].options.length + 1}`);
    setQuestions(newQs);
  };

  const deleteQuestion = (qIndex: number) => {
    const newQs = [...questions];
    newQs.splice(qIndex, 1);
    setQuestions(newQs);
  };

  const addBlankQuestion = () => {
    setQuestions([...questions, {
      text: 'Новый вопрос',
      options: ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'],
      correct_answers: ['[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]']
    }]);
    setShowAddMenu(false);
  };

  const handleAIParse = async () => {
    if (!importText.trim()) return;
    setIsAIParsing(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText })
      });
      if (!res.ok) throw new Error('Ошибка API ИИ');
      
      const data = await res.json();
      const allQuestions = data.questions || [];
      if (allQuestions.length > 0) {
        setQuestions([...questions, ...allQuestions]);
        setShowTextImport(false);
        setImportText('');
      } else {
        alert('Не найдено ни одного вопроса.');
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка при работе с ИИ');
    } finally {
      setIsAIParsing(false);
    }
  };

  const handleManualParse = () => {
    if (!importText.trim()) return;
    const result = parseQuizText(importText);
    if (result.questions.length > 0) {
      setQuestions([...questions, ...result.questions]);
      setShowTextImport(false);
      setImportText('');
    } else {
      alert(result.errors.join('\\n') || 'Не удалось распознать вопросы');
    }
  };

  const handleUpdate = () => {
    if (!title.trim()) {
      alert('Название теста обязательно.');
      return;
    }
    const missingCount = questions.filter(q => q.correct_answers.includes('[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]')).length;
    if (missingCount > 0) {
      alert(`Пожалуйста, выберите правильные ответы в ${missingCount} вопросах.`);
      return;
    }

    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      await quizService.update(quiz.id, { title: title.trim() });
      await quizService.deleteQuestions(quiz.id);

      await quizService.createQuestions(
        questions.map((q, i) => ({
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

  const hasAnyMissing = questions.some(q => q.correct_answers.includes('[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]'));

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-12 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{ru.editQuizTitle}</h1>
        <p className="text-sm text-zinc-400 mt-2">Отредактируйте вопросы, варианты и правильные ответы.</p>
      </div>

      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Название теста"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-lg font-medium text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
        />

        <div className="flex flex-col gap-6">
          {questions.map((q, i) => {
            const hasNoAnswers = q.correct_answers.includes('[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]');
            return (
              <div key={i} className={`bg-white/5 border rounded-2xl p-6 transition-all relative group ${hasNoAnswers ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'border-white/10'}`}>
                <button onClick={() => deleteQuestion(i)} className="absolute top-4 right-4 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-2" title="Удалить вопрос">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
                
                <div className="mb-5 flex gap-3">
                  <span className="text-lg font-medium text-white/50 pt-2">{i + 1}.</span>
                  <textarea
                    value={q.text}
                    onChange={(e) => updateQuestionText(i, e.target.value)}
                    className="flex-1 bg-transparent border-none text-lg font-medium text-white/90 resize-none focus:outline-none focus:ring-0 p-2 hover:bg-white/5 rounded-lg transition-colors"
                    rows={Math.max(1, q.text.split('\\n').length)}
                  />
                </div>

                <div className="flex flex-col gap-3 pl-8">
                  {q.options.map((opt, j) => {
                    const isCorrect = q.correct_answers.includes(opt);
                    return (
                      <div key={j} className={`flex items-center gap-4 p-2 pl-4 rounded-xl border transition-all duration-200 ${isCorrect ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-100' : 'bg-black/20 border-white/5 text-zinc-300 hover:bg-white/5'}`}>
                        <button onClick={() => toggleCorrectAnswer(i, opt)} className={`w-5 h-5 shrink-0 rounded flex items-center justify-center transition-colors ${isCorrect ? 'bg-indigo-500 text-white' : 'border border-white/20 bg-black/50'}`}>
                          {isCorrect && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(i, j, e.target.value)}
                          className="flex-1 bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-0 py-2"
                        />
                        <button onClick={() => deleteOption(i, j)} className="text-zinc-600 hover:text-red-400 p-2 pr-4 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                      </div>
                    )
                  })}
                  <button onClick={() => addOption(i)} className="text-xs font-medium text-zinc-500 hover:text-white flex items-center gap-2 px-4 py-2 mt-2 w-max rounded-lg hover:bg-white/5 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Добавить вариант
                  </button>
                </div>
                {hasNoAnswers && (
                  <p className="text-sm text-red-400 mt-4 font-medium flex items-center gap-2 pl-8">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Выберите правильный ответ
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Add Question Island */}
        <div className="relative mx-auto mt-4">
          {!showTextImport && (
            <div className="relative">
              <Button onClick={() => setShowAddMenu(!showAddMenu)} variant="ghost" className="rounded-full shadow-lg border-white/20 bg-white/5 backdrop-blur-md px-6 py-2 flex items-center gap-2 hover:bg-white/10 hover:border-white/30 text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                Добавить вопрос
              </Button>
              {showAddMenu && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  <button onClick={addBlankQuestion} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5">
                    📝 Ручной ввод
                  </button>
                  <button onClick={() => {setShowTextImport(true); setShowAddMenu(false);}} className="w-full text-left px-4 py-3 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                    ✨ Импорт текстом
                  </button>
                </div>
              )}
            </div>
          )}

          {showTextImport && (
            <div className="w-full max-w-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-slide-fade">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-indigo-400">Импорт вопросов</h3>
                <button onClick={() => setShowTextImport(false)} className="text-zinc-500 hover:text-white p-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Вставьте вопросы..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y min-h-[150px] mb-4"
              />
              <div className="flex gap-3">
                <Button onClick={handleManualParse} variant="ghost" className="flex-1">
                  Обычный парсер
                </Button>
                <Button onClick={handleAIParse} loading={isAIParsing} className="flex-1 bg-indigo-600 hover:bg-indigo-500">
                  ✨ ИИ парсер
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 sticky bottom-6 p-5 mt-8 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-40">
          <Button onClick={() => router.back()} variant="ghost" className="px-6">
            Отмена
          </Button>
          <Button onClick={handleUpdate} loading={isPending} className="flex-1 text-base font-semibold" disabled={hasAnyMissing || questions.length === 0}>
            {hasAnyMissing ? 'Заполните все правильные ответы' : ru.editQuiz}
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
