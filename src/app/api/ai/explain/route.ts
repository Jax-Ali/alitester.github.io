import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { callGemini } from '@/lib/ai/gemini';

export interface ExplanationResponse {
  why_student_is_wrong: string;
  why_correct_is_right: string;
  rule_to_remember: string;
  example: string;
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

    // 2. Validate input parameters
    const body = await req.json().catch(() => null);
    const { attemptId, questionId } = body || {};

    if (!attemptId || typeof attemptId !== 'string' || !questionId || typeof questionId !== 'string') {
      return NextResponse.json(
        { error: 'Параметры attemptId и questionId обязательны' },
        { status: 400 }
      );
    }

    // 3. Fetch attempt and verify ownership
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json({ error: 'Попытка не найдена' }, { status: 404 });
    }

    if (attempt.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Доступ запрещён: эта попытка принадлежит другому пользователю' },
        { status: 403 }
      );
    }

    // 4. Fetch question independently from database
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Вопрос не найден' }, { status: 404 });
    }

    // Verify question belongs to the quiz of this attempt
    if (question.quiz_id !== attempt.quiz_id) {
      return NextResponse.json(
        { error: 'Вопрос не принадлежит данному тесту' },
        { status: 400 }
      );
    }

    // Verify correct answers are valid
    if (
      !Array.isArray(question.correct_answers) ||
      question.correct_answers.length === 0 ||
      question.correct_answers.includes('[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]')
    ) {
      return NextResponse.json(
        { error: 'Для данного вопроса отсутствуют эталонные правильные ответы' },
        { status: 422 }
      );
    }

    // 5. Extract student's selection for this question
    const studentSelection: string[] = attempt.answers?.[question.id] ?? [];

    // 6. Build prompt with Ground Truth
    const systemInstruction = `Ты — опытный, доброжелательный преподаватель-методист.
Твоя задача — доступно объяснить студенту его ошибку в тестовом вопросе на русском языке.

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. ЭТАЛОННЫЕ ПРАВИЛЬНЫЕ ОТВЕТЫ, переданные тебе — это абсолютная истина (Ground Truth). Не пытайся их оспаривать, изменять или заменять своими догадками.
2. В вопросе может быть как один правильный ответ, так и несколько.
3. Студент мог:
   - Выбрать полностью неправильный вариант.
   - Выбрать правильный вариант плюс лишний неправильный.
   - Выбрать только часть правильных ответов (например, 1 из 2 необходимых).
   - Не выбрать ничего (пропустить вопрос).
4. Объяснение должно быть чётким, педагогически грамотным, без воды и сложных наукообразных перегрузок.

ФОРМАТ ОТВЕТА:
Отвечай СТРОГО в формате валидного JSON-объекта со следующими 4 обязательными строковыми полями:
{
  "why_student_is_wrong": "Понятное объяснение, в чём ошибка студента (какой неверный вариант выбран и почему, либо какие правильные варианты он не заметил). Если вопрос был пропущен — укажи это.",
  "why_correct_is_right": "Ёмкое объяснение, почему именно эталонный ответ (или каждый из них) является верным с точки зрения предмета.",
  "rule_to_remember": "Главное правило, закон, формула или определение, которое нужно запомнить.",
  "example": "Простой наглядный пример из жизни или практики, помогающий закрепить суть."
}`;

    const userPrompt = `Вопрос:
"""
${question.text}
"""

Все варианты ответа:
${question.options.map((opt: string, i: number) => `${i + 1}. ${opt}`).join('\n')}

ЭТАЛОННЫЕ ПРАВИЛЬНЫЕ ОТВЕТЫ (Ground Truth):
${question.correct_answers.map((ans: string) => `✓ ${ans}`).join('\n')}

Выбор студента:
${studentSelection.length > 0 ? studentSelection.map((ans: string) => `• ${ans}`).join('\n') : '— Студент не выбрал ни одного ответа (пропустил вопрос)'}`;

    // 7. Call Gemini via isolated client
    const aiText = await callGemini({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction,
      temperature: 0.2,
      responseMimeType: 'application/json',
      timeoutMs: 25000,
    });

    let explanation: ExplanationResponse;
    try {
      explanation = JSON.parse(aiText);
    } catch {
      return NextResponse.json(
        { error: 'Не удалось разобрать структурированный ответ ИИ. Пожалуйста, попробуйте снова.' },
        { status: 502 }
      );
    }

    // 8. Strict runtime validation of the JSON response
    if (
      typeof explanation.why_student_is_wrong !== 'string' ||
      typeof explanation.why_correct_is_right !== 'string' ||
      typeof explanation.rule_to_remember !== 'string' ||
      typeof explanation.example !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Ответ модели не содержит всех требуемых полей объяснения' },
        { status: 502 }
      );
    }

    return NextResponse.json({ explanation });
  } catch (error: any) {
    console.error('AI Explain Route Error:', error);

    if (error.message === 'GEMINI_API_KEY_MISSING') {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY не настроен на сервере' },
        { status: 500 }
      );
    }

    if (error.message === 'GEMINI_RATE_LIMIT') {
      return NextResponse.json(
        { error: 'Сервис ИИ временно перегружен. Пожалуйста, подождите несколько секунд и повторите запрос.' },
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
      { error: error.message || 'Внутренняя ошибка сервера при генерации объяснения' },
      { status: 500 }
    );
  }
}
