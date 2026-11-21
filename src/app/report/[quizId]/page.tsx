'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { quizService } from '@/services/quiz.service';
import { attemptService } from '@/services/attempt.service';
import {
  analyticsService,
  ANALYTICS_THRESHOLDS,
  type QuizAnalyticsSummary,
} from '@/services/analytics.service';
import type { QuizRow, QuestionRow, AttemptRow } from '@/types';
import type { AIReportData } from '@/app/api/ai/report/route';
import { Button } from '@/components/ui/Button';

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function ReportPage({ params }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [summary, setSummary] = useState<QuizAnalyticsSummary | null>(null);

  // AI report state
  const [aiReport, setAiReport] = useState<AIReportData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { quizId } = await params;

        // 1. Check user session
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = `/auth?redirect=/report/${quizId}`;
          return;
        }

        // 2. Fetch quiz and verify ownership
        const quizData = await quizService.getById(quizId);
        if (!quizData) {
          setError('Тест не найден');
          return;
        }

        if (quizData.created_by !== user.id) {
          const { data: profile } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single();

          if (!profile?.is_admin) {
            setError('У вас нет прав для просмотра аналитики этого теста');
            return;
          }
        }

        setQuiz(quizData);

        // 3. Load questions and attempts
        const [questions, attempts]: [QuestionRow[], AttemptRow[]] = await Promise.all([
          quizService.getQuestions(quizId),
          attemptService.getByQuiz(quizId),
        ]);

        // 4. Calculate deterministic analytics
        const stats = analyticsService.calculateAnalytics(quizId, questions, attempts);
        setSummary(stats);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGenerateAIReport = async () => {
    if (!quiz) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) throw new Error('Сессия истекла. Войдите снова.');

      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quizId: quiz.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось сгенерировать ИИ-отчёт');
      }

      setAiReport(data.report);
    } catch (err: any) {
      setAiError(err.message || 'Ошибка при получении аналитики ИИ');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Загрузка аналитики теста...</p>
      </div>
    );
  }

  if (error || !quiz || !summary) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-md">
          {error || 'Не удалось загрузить отчёт'}
        </div>
        <Link href="/dashboard" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Вернуться в дашборд
        </Link>
      </div>
    );
  }

  const sampleSize = summary.totalAttempts;
  const isBelowMin = sampleSize < ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS;
  const isSmallSample =
    sampleSize >= ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS &&
    sampleSize < ANALYTICS_THRESHOLDS.MIN_FOR_FULL_CONFIDENCE;

  return (
    <div className="min-h-screen bg-zinc-950 text-white px-4 py-8 sm:px-6 lg:px-8 max-w-5xl mx-auto flex flex-col gap-8">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <Link
            href="/dashboard"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1 mb-2"
          >
            ← В дашборд
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
            <span>📊</span>
            <span>Аналитический отчёт</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">{quiz.title}</p>
        </div>

        {/* Sample size status indicator */}
        <div className="flex items-center gap-2">
          {isBelowMin ? (
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Мало данных ({sampleSize} / {ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS} попыток)</span>
            </span>
          ) : isSmallSample ? (
            <span className="text-xs px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-1.5">
              <span>ℹ️</span>
              <span>Предварительная аналитика ({sampleSize} попыток)</span>
            </span>
          ) : (
            <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
              <span>✓</span>
              <span>Выборка достаточна ({sampleSize} попыток)</span>
            </span>
          )}
        </div>
      </div>

      {/* Notice alert if sample size is small */}
      {summary.dataQuality.notice && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed flex items-start gap-2.5">
          <span className="text-base shrink-0">📌</span>
          <span>{summary.dataQuality.notice}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="text-xs text-zinc-500 font-medium">Всего попыток</span>
          <span className="text-2xl font-bold text-white">{summary.totalAttempts}</span>
          <span className="text-[11px] text-zinc-500">Учеников: {summary.uniqueStudents}</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="text-xs text-zinc-500 font-medium">Средний балл</span>
          <span
            className={`text-2xl font-bold ${
              summary.averageScore >= 75
                ? 'text-emerald-400'
                : summary.averageScore >= 50
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          >
            {summary.averageScore}%
          </span>
          <span className="text-[11px] text-zinc-500">По всем попыткам</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="text-xs text-zinc-500 font-medium">Медианный балл</span>
          <span className="text-2xl font-bold text-indigo-400">{summary.medianScore}%</span>
          <span className="text-[11px] text-zinc-500">Центральное значение</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
          <span className="text-xs text-zinc-500 font-medium">Успеваемость</span>
          <span className="text-2xl font-bold text-white">
            {summary.totalAttempts > 0
              ? `${Math.round(
                  ((summary.distribution.excellent + summary.distribution.good) /
                    summary.totalAttempts) *
                    100
                )}%`
              : '0%'}
          </span>
          <span className="text-[11px] text-zinc-500">Сдали на 75%+</span>
        </div>
      </div>

      {/* Score Distribution Section */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-300">Распределение оценок</h2>

        {summary.totalAttempts === 0 ? (
          <p className="text-xs text-zinc-500 py-2">Пока нет завершённых попыток.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Visual segmented bar */}
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${(summary.distribution.excellent / summary.totalAttempts) * 100}%`,
                }}
                className="bg-emerald-500 h-full transition-all"
                title={`Отлично: ${summary.distribution.excellent}`}
              />
              <div
                style={{
                  width: `${(summary.distribution.good / summary.totalAttempts) * 100}%`,
                }}
                className="bg-indigo-500 h-full transition-all"
                title={`Хорошо: ${summary.distribution.good}`}
              />
              <div
                style={{
                  width: `${(summary.distribution.satisfactory / summary.totalAttempts) * 100}%`,
                }}
                className="bg-amber-500 h-full transition-all"
                title={`Удовлетворительно: ${summary.distribution.satisfactory}`}
              />
              <div
                style={{
                  width: `${(summary.distribution.poor / summary.totalAttempts) * 100}%`,
                }}
                className="bg-red-500 h-full transition-all"
                title={`Неудовлетворительно: ${summary.distribution.poor}`}
              />
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-zinc-400">90–100%:</span>
                <span className="font-semibold text-white">{summary.distribution.excellent}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-zinc-400">75–89%:</span>
                <span className="font-semibold text-white">{summary.distribution.good}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-zinc-400">50–74%:</span>
                <span className="font-semibold text-white">{summary.distribution.satisfactory}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <span className="text-zinc-400">0–49%:</span>
                <span className="font-semibold text-white">{summary.distribution.poor}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Teacher Insights Section */}
      <div className="rounded-2xl bg-gradient-to-b from-indigo-950/20 via-zinc-900/40 to-black/40 border border-indigo-500/25 p-5 sm:p-6 flex flex-col gap-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-4">
          <div>
            <h2 className="text-base font-semibold text-indigo-300 flex items-center gap-2">
              <span>✨</span>
              <span>Педагогический ИИ-анализ (AI Insights)</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Gemini анализирует реальные паттерны ошибок, спутанные понятия и формирует методические рекомендации.
            </p>
          </div>

          {!isBelowMin && (
            <Button
              type="button"
              onClick={handleGenerateAIReport}
              disabled={aiLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 shrink-0 font-medium shadow-md cursor-pointer disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                  <span>Анализирую данные...</span>
                </>
              ) : (
                <span>{aiReport ? '🔄 Обновить ИИ-отчёт' : '✨ Сформировать ИИ-отчёт'}</span>
              )}
            </Button>
          )}
        </div>

        {/* State: below minimum threshold */}
        {isBelowMin ? (
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center gap-2">
            <span className="text-3xl">⏳</span>
            <h3 className="text-sm font-semibold text-zinc-300">
              Недостаточно данных для ИИ-аналитики
            </h3>
            <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
              Для запуска интеллектуального анализа студенты должны пройти тест минимум{' '}
              <strong className="text-zinc-400">{ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS} раза</strong> (сейчас:{' '}
              {sampleSize}). Поделитесь ссылкой на тест со студентами.
            </p>
          </div>
        ) : aiError ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between gap-3">
            <span>{aiError}</span>
            <button
              onClick={handleGenerateAIReport}
              className="underline hover:no-underline font-medium shrink-0 text-red-200"
            >
              Попробовать снова
            </button>
          </div>
        ) : aiReport ? (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
                  <span>❌</span> Паттерны ошибок
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">{aiReport.error_patterns}</p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <span>🔀</span> Спутанные понятия
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">{aiReport.confused_concepts}</p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                  <span>📚</span> Темы для повторения
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">{aiReport.topics_to_review}</p>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <span>🎓</span> Рекомендации преподавателю
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {aiReport.pedagogical_recommendations}
                </p>
              </div>
            </div>

            {/* Action plan */}
            <div className="p-5 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>📋</span>
                <span>План действий на следующем занятии</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* 1. What to review */}
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-indigo-400">🎯 Что разобрать:</span>
                  <ul className="space-y-1.5 list-disc list-inside text-zinc-300 leading-relaxed">
                    {aiReport.action_plan.lesson_review.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* 2. Exercise examples */}
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-amber-400">✍️ Примеры упражнений:</span>
                  <ul className="space-y-1.5 list-disc list-inside text-zinc-300 leading-relaxed">
                    {aiReport.action_plan.exercise_examples.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Followup questions */}
                <div className="flex flex-col gap-2">
                  <span className="font-medium text-emerald-400">❓ Проверочные вопросы:</span>
                  <ul className="space-y-1.5 list-disc list-inside text-zinc-300 leading-relaxed">
                    {aiReport.action_plan.recommended_followup_questions.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 text-center flex flex-col items-center gap-2.5">
            <p className="text-xs text-zinc-400">
              Статистика собрана. Нажмите кнопку выше, чтобы запустить интеллектуальный педагогический анализ.
            </p>
          </div>
        )}
      </div>

      {/* Problem Questions («Красная зона») */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>🔥</span>
            <span>Проблемные вопросы (Антирейтинг ошибок)</span>
          </h2>
          <span className="text-xs text-zinc-500">Сортировка по % ошибок</span>
        </div>

        {summary.hardestQuestions.length === 0 || summary.totalAttempts === 0 ? (
          <p className="text-xs text-zinc-500 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            Нет данных по вопросам.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {summary.hardestQuestions.slice(0, 5).map((q, idx) => (
              <div
                key={q.questionId}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white leading-snug">{q.text}</p>
                      {q.metadata?.topic && (
                        <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md inline-block mt-1">
                          Тема: {q.metadata.topic}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-400">
                      {q.errorRatePercent}% ошибок
                    </span>
                  </div>
                </div>

                {/* Top distractor alert */}
                {q.topDistractor && (
                  <div className="text-xs p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>
                      Главный ошибочный выбор студентов: <strong>«{q.topDistractor}»</strong>
                    </span>
                  </div>
                )}

                {/* Options frequency breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  {q.optionsFrequency.map((opt) => (
                    <div
                      key={opt.option}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        opt.isCorrect
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : opt.count > 0
                          ? 'border-red-500/30 bg-red-500/10 text-red-300'
                          : 'border-white/5 bg-white/[0.01] text-zinc-500'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <span>{opt.isCorrect ? '✓' : '✕'}</span>
                        <span className="truncate">{opt.option}</span>
                      </span>
                      <span className="shrink-0 font-medium">
                        {opt.count} чел. ({opt.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Topics Analytics Section (if topics exist) */}
      {summary.topics.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-white/10 pt-6">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>🏷️</span>
            <span>Успеваемость по темам</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {summary.topics.map((t) => (
              <div
                key={t.topic}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate">{t.topic}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      t.masteryLevel === 'high'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : t.masteryLevel === 'medium'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {t.masteryLevel === 'high'
                      ? 'Высокий'
                      : t.masteryLevel === 'medium'
                      ? 'Средний'
                      : 'Низкий'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white">{t.averageScorePercent}%</span>
                  <span className="text-xs text-zinc-500">средний балл</span>
                </div>
                <span className="text-[11px] text-zinc-500">Вопросов в теме: {t.questionCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
