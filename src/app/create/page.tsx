'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parseQuizText, ParsedQuestion } from '@/utils/quizParser';
import { quizService } from '@/services/quiz.service';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { ru } from '@/lib/i18n/ru';

const EXAMPLE = `Вставьте сюда свой текст...
Например, формат QAC:
Q: What is the capital of France?
A: Berlin | Paris | Rome
C: Paris

Или университетский формат:
Question 1
Какой язык программирования лучше?
JavaScript
Python
C++`;

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  
  const [isAIParsing, setIsAIParsing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  const handleAIParse = async () => {
    setIsAIParsing(true);
    setErrors([]);
    setAiProgress(0);
    try {
      const chunks = text.split(/\n\s*\n/).reduce((acc, block) => {
        if (acc.length === 0) acc.push(block);
        else {
          const last = acc[acc.length - 1];
          if (last.length + block.length < 2000) {
            acc[acc.length - 1] = last + '\n\n' + block;
          } else {
            acc.push(block);
          }
        }
        return acc;
      }, [] as string[]);

      let allQuestions: any[] = [];
      for (let i = 0; i < chunks.length; i++) {
        setAiProgress(Math.round((i / chunks.length) * 100));
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunks[i] })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Ошибка API ИИ');
        }
        
        const data = await res.json();
        if (data.questions) {
          allQuestions.push(...data.questions);
        }
      }
      setAiProgress(100);

      setParsedQuestions(allQuestions);
      setErrors([]);
      setStep('preview');
      
    } catch (err: any) {
      setErrors([err.message || 'Ошибка при работе с ИИ']);
    } finally {
      setIsAIParsing(false);
      setTimeout(() => setAiProgress(0), 2000);
    }
  };

  const handlePreview = () => {
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

    setParsedQuestions(result.questions);
    setErrors([]);
    setStep('preview');
  };

  const toggleCorrectAnswer = (qIndex: number, option: string) => {
    const newQs = [...parsedQuestions];
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
    setParsedQuestions(newQs);
  };

  const handleFinalCreate = () => {
    const missingCount = parsedQuestions.filter(q => q.correct_answers.includes('[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]')).length;
    if (missingCount > 0) {
      alert(`Пожалуйста, выберите правильные ответы в ${missingCount} вопросах.`);
      return;
    }

    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const quiz = await quizService.create({
        title: title.trim(),
        created_by: user.id,
      });

      await quizService.createQuestions(
        parsedQuestions.map((q, i) => ({
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

  if (step === 'preview') {
    const hasAnyMissing = parsedQuestions.some(q => q.correct_answers.includes('[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]'));
    return (
      <div className="min-h-screen max-w-3xl mx-auto px-4 py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold">Предпросмотр: {title}</h1>
          <p className="text-sm text-zinc-400 mt-2">Проверьте правильность распознавания ответов. Вы можете изменить правильные ответы, кликая по ним.</p>
        </div>

        <div className="flex flex-col gap-6">
          {parsedQuestions.map((q, i) => {
            const hasNoAnswers = q.correct_answers.includes('[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]');
            return (
              <div key={i} className={`bg-white/5 border rounded-2xl p-6 transition-all ${hasNoAnswers ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'border-white/10'}`}>
                 <h3 className="text-lg font-medium mb-5 text-white/90">{i + 1}. {q.text}</h3>
                 <div className="flex flex-col gap-3">
                   {q.options.map((opt, j) => {
                     const isCorrect = q.correct_answers.includes(opt);
                     return (
                       <label key={j} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all duration-200 ${isCorrect ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-100' : 'bg-black/20 border-white/5 text-zinc-300 hover:bg-white/5'}`}>
                         <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isCorrect ? 'bg-indigo-500 text-white' : 'border border-white/20 bg-black/50'}`}>
                           {isCorrect && (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                             </svg>
                           )}
                         </div>
                         <span className="text-sm font-medium">{opt}</span>
                       </label>
                     )
                   })}
                 </div>
                 {hasNoAnswers && (
                   <p className="text-sm text-red-400 mt-4 font-medium flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Пожалуйста, выберите хотя бы один правильный ответ
                   </p>
                 )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-4 sticky bottom-6 p-5 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50">
          <Button onClick={() => setStep('input')} variant="ghost" className="px-6">
             Назад
          </Button>
          <Button onClick={handleFinalCreate} loading={isPending} className="flex-1 text-base font-semibold" disabled={hasAnyMissing}>
             {hasAnyMissing ? 'Заполните все ответы' : 'Сохранить и создать тест'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-12 flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">{ru.createQuizTitle}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {ru.createQuizDesc}
        </p>
      </div>

      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-6 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-indigo-400">✨ Умный парсер тестов</h2>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Просто скопируйте и вставьте ваш текст. Наш умный алгоритм сам распознает формат Platonus (где правильные ответы идут первыми), либо классические форматы с плюсиками и звездочками (+ Ответ, * Ответ). 
          Если формат слишком сложный, мы подключим ИИ!
        </p>
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
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-xs text-red-400 font-medium mb-2">Проблема с распознаванием:</p>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-400">{e}</li>
                ))}
              </ul>
            </div>
            
            <Button 
              onClick={handleAIParse} 
              loading={isAIParsing} 
              variant="ghost" 
              className="w-full mt-2 border border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              {isAIParsing ? `Распознавание ИИ... ${aiProgress}%` : '✨ Распознать через ИИ'}
            </Button>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={() => router.back()} variant="ghost">
            {ru.cancel}
          </Button>
          <Button
            onClick={handlePreview}
            disabled={!text.trim() || isAIParsing}
            className="flex-1"
          >
            Предпросмотр теста
          </Button>
        </div>
      </div>
    </div>
  );
}
