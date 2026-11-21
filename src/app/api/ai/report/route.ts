import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { quizService } from '@/services/quiz.service';
import { attemptService } from '@/services/attempt.service';
import { analyticsService, ANALYTICS_THRESHOLDS } from '@/services/analytics.service';
import { callGemini } from '@/lib/ai/gemini';

export interface AIReportData {
  error_patterns: string;
  confused_concepts: string;
  topics_to_review: string;
  pedagogical_recommendations: string;
  action_plan: {
    lesson_review: string[];
    exercise_examples: string[];
    recommended_followup_questions: string[];
  };
}

export async function POST(req: Request) {
  try {
    // 1. Authorization check
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Недействительная сессия' }, { status: 401 });
    }

    // 2. Validate quizId
    const body = await req.json().catch(() => null);
    const { quizId } = body || {};

    if (!quizId || typeof quizId !== 'string') {
      return NextResponse.json({ error: 'Параметр quizId обязателен' }, { status: 400 });
    }

    // 3. Fetch quiz and verify ownership
    const quiz = await quizService.getById(quizId);
    if (!quiz) {
      return NextResponse.json({ error: 'Тест не найден' }, { status: 404 });
    }

    // Check if user is creator or admin
    if (quiz.created_by !== user.id) {
      const { data: userProfile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!userProfile?.is_admin) {
        return NextResponse.json(
          { error: 'Доступ запрещён: вы можете просматривать аналитику только своих тестов' },
          { status: 403 }
        );
      }
    }

    // 4. Load questions and attempts
    const [questions, attempts] = await Promise.all([
      quizService.getQuestions(quizId),
      attemptService.getByQuiz(quizId),
    ]);

    // 5. Calculate statistics using pure deterministic math
    const summary = analyticsService.calculateAnalytics(quizId, questions, attempts);

    // 6. Check data sufficiency threshold
    if (summary.totalAttempts < ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS) {
      return NextResponse.json(
        {
          error: `Недостаточно данных для ИИ-анализа. Требуется минимум ${ANALYTICS_THRESHOLDS.MIN_FOR_AI_ANALYSIS} попытки (сейчас: ${summary.totalAttempts}).`,
          summary,
        },
        { status: 422 }
      );
    }

    // 7. Prepare prompt for Gemini
    const isSmallSample = summary.totalAttempts < ANALYTICS_THRESHOLDS.MIN_FOR_FULL_CONFIDENCE;

    const systemInstruction = `Ты — профессиональный педагог-методист и эксперт по анализу результатов тестирования.
Твоя задача — составить глубокий, практичный аналитический отчёт для преподавателя на основе РЕАЛЬНЫХ данных тестирования.

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. Все предоставленные числа — это окончательная статистика. НЕ изменяй их, не выдумывай другие проценты и не искажай результаты.
2. Не делай категоричных заявлений, если данных мало. 
   ${
     isSmallSample
       ? `ВНИМАНИЕ: Выборка небольшая (${summary.totalAttempts} попыток). Все выводы должны быть предварительными и рекомендательными (используй формулировки "по предварительным данным", "вероятно", "стоит уделить внимание").`
       : 'Выборка достаточная, делай уверенные методические выводы.'
   }
3. Сконцентрируйся на ПОНИМАНИИ студентами материала: почему они выбирали конкретный дистрактор (ложный вариант), какое базовое правило не усвоено.
4. Отчёт должен быть полезным и сразу применимым на следующем занятии.

ФОРМАТ ОТВЕТА:
Отвечай СТРОГО в формате валидного JSON-объекта со следующей структурой:
{
  "error_patterns": "Анализ причин повторяющихся ошибок и общая картина понимания материала учащимися.",
  "confused_concepts": "Какие конкретные понятия, определения или правила студенты путают чаще всего (на основе выбранных дистракторов).",
  "topics_to_review": "Ключевые темы и концепции, требующие повторного разбора.",
  "pedagogical_recommendations": "Практические рекомендации преподавателю по улучшению методики подачи этих тем.",
  "action_plan": {
    "lesson_review": [
      "Конкретный пункт 1 для разбора в начале урока",
      "Конкретный пункт 2..."
    ],
    "exercise_examples": [
      "Пример тренировочного упражнения 1 для снятия типичного заблуждения",
      "Пример упражнения 2..."
    ],
    "recommended_followup_questions": [
      "Контрольный проверочный вопрос 1 для закрепления",
      "Контрольный проверочный вопрос 2..."
    ]
  }
}`;

    // Format top hardest questions for context
    const hardestQuestionsSlice = summary.hardestQuestions.slice(0, 5).map((q, idx) => {
      return `Вопрос №${idx + 1}: """${q.text}"""
- Процент ошибок: ${q.errorRatePercent}%
- Эталонный правильный ответ: ${questions.find((item) => item.id === q.questionId)?.correct_answers.join(', ')}
${q.topDistractor ? `- Самый частый ошибочный выбор (дистрактор): "${q.topDistractor}"` : ''}
${q.metadata?.topic ? `- Тема: "${q.metadata.topic}"` : ''}`;
    });

    // Format topics performance
    const topicsSlice = summary.topics.map(
      (t) => `- Тема "${t.topic}": средний балл ${t.averageScorePercent}% (уровень: ${t.masteryLevel})`
    );

    const userPrompt = `Тест: "${quiz.title}"
Общая статистика:
- Всего попыток: ${summary.totalAttempts}
- Уникальных студентов: ${summary.uniqueStudents}
- Средний результат: ${summary.averageScore}%
- Медианный результат: ${summary.medianScore}%
- Распределение: ${summary.distribution.excellent} отличных, ${summary.distribution.good} хороших, ${summary.distribution.satisfactory} удовл., ${summary.distribution.poor} неудовл.

Самые проблемные вопросы с частыми ошибками:
${hardestQuestionsSlice.join('\n\n')}

${topicsSlice.length > 0 ? `Успеваемость по темам:\n${topicsSlice.join('\n')}` : ''}

Составь методический отчёт для преподавателя с планом действий.`;

    // 8. Call Gemini
    const aiText = await callGemini({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction,
      temperature: 0.2,
      responseMimeType: 'application/json',
      timeoutMs: 30000,
    });

    let report: AIReportData;
    try {
      report = JSON.parse(aiText);
    } catch {
      return NextResponse.json(
        { error: 'Не удалось разобрать структурированный ответ ИИ. Попробуйте еще раз.', summary },
        { status: 502 }
      );
    }

    // 9. Runtime validation of JSON report structure
    if (
      typeof report.error_patterns !== 'string' ||
      typeof report.confused_concepts !== 'string' ||
      typeof report.topics_to_review !== 'string' ||
      typeof report.pedagogical_recommendations !== 'string' ||
      !report.action_plan ||
      !Array.isArray(report.action_plan.lesson_review) ||
      !Array.isArray(report.action_plan.exercise_examples) ||
      !Array.isArray(report.action_plan.recommended_followup_questions)
    ) {
      return NextResponse.json(
        { error: 'Ответ модели не содержит обязательных полей отчёта', summary },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary, report });
  } catch (error: any) {
    console.error('AI Report Route Error:', error);

    if (error.message === 'GEMINI_API_KEY_MISSING') {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY не настроен на сервере' },
        { status: 500 }
      );
    }

    if (error.message === 'GEMINI_RATE_LIMIT') {
      return NextResponse.json(
        { error: 'Сервер ИИ перегружен. Пожалуйста, подождите 10 секунд и повторите запрос.' },
        { status: 429 }
      );
    }

    if (error.message === 'GEMINI_TIMEOUT') {
      return NextResponse.json(
        { error: 'Время ожидания ответа ИИ истекло. Пожалуйста, повторите запрос.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Ошибка сервера при формировании отчёта' },
      { status: 500 }
    );
  }
}
