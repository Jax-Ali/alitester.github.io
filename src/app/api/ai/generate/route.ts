import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { callGemini } from '@/lib/ai/gemini';
import type { ParsedQuestion, QuestionMetadata } from '@/types';

// Helper: Normalize text for deduplication
function normalizeText(str: string): string {
  return str.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

// Helper: Check if two question texts are suspiciously similar (Jaccard token overlap > 0.75)
function isTooSimilar(a: string, b: string): boolean {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (normA === normB) return true;

  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union > 0.75;
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
    const {
      topic = '',
      sourceText = '',
      count = 5,
      difficulty = 'medium',
      allowMultiple = false,
      existingQuestions = [],
    } = body || {};

    const cleanTopic = typeof topic === 'string' ? topic.trim() : '';
    const cleanSource = typeof sourceText === 'string' ? sourceText.trim() : '';

    if (!cleanTopic && !cleanSource) {
      return NextResponse.json(
        { error: 'Укажите тему теста или вставьте учебный материал' },
        { status: 400 }
      );
    }

    if (cleanTopic.length > 500) {
      return NextResponse.json(
        { error: 'Тема не должна превышать 500 символов' },
        { status: 400 }
      );
    }

    if (cleanSource.length > 25000) {
      return NextResponse.json(
        { error: 'Размер учебного материала не должен превышать 25 000 символов' },
        { status: 400 }
      );
    }

    const safeCount = Math.max(1, Math.min(20, parseInt(String(count), 10) || 5));
    const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';

    // 3. System prompt construction
    const systemInstruction = `Ты — профессиональный преподаватель и эксперт по педагогическому тестированию.
Твоя задача — составить качественные тестовые вопросы на русском языке.

ТРЕБОВАНИЯ К ВОПРОСАМ:
1. Вопрос должен проверять понимание сути, а не механическое заучивание.
2. Сложность вопросов: ${safeDifficulty.toUpperCase()}.
3. Количество вопросов: ровно ${safeCount}.
4. В каждом вопросе должно быть от 4 до 5 вариантов ответа.
5. Неправильные варианты (дистракторы) должны быть правдоподобными, реалистичными и отражать типичные ошибки учащихся. Никаких нелепых или очевидно абсурдных вариантов.
6. Правильные ответы:
   ${
     allowMultiple
       ? 'РАЗРЕШЕНО создавать как вопросы с одним правильным ответом, так и с 2-3 правильными ответами.'
       : 'СТРОГО один правильный ответ на каждый вопрос.'
   }
7. Все правильные ответы в массиве "correct_answers" ОБЯЗАНЫ в точности совпадать с соответствующими строками из "options".
8. Краткое объяснение ("explanation") к каждому вопросу (почему правильный ответ верен).
9. В "metadata" укажи тему ("topic"), сложность ("difficulty": "${safeDifficulty}") и при наличии предмет ("subject").

ФОРМАТ ОТВЕТА:
Отвечай СТРОГО в формате валидного JSON-массива объектов:
[
  {
    "text": "Текст вопроса?",
    "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
    "correct_answers": ["Вариант 2"],
    "explanation": "Краткое объяснение правильного ответа.",
    "metadata": {
      "topic": "${cleanTopic || 'Общая тема'}",
      "difficulty": "${safeDifficulty}"
    }
  }
]`;

    let userPrompt = `Составь ${safeCount} тестовых вопросов сложности ${safeDifficulty}.`;

    if (cleanTopic) {
      userPrompt += `\nТема: """${cleanTopic}"""`;
    }

    if (cleanSource) {
      userPrompt += `\nУчебный материал:\n"""\n${cleanSource}\n"""`;
    }

    if (Array.isArray(existingQuestions) && existingQuestions.length > 0) {
      const existingSlice = existingQuestions
        .filter((q) => typeof q === 'string' && q.trim())
        .slice(-30);

      if (existingSlice.length > 0) {
        userPrompt += `\n\nВнимание: в тесте УЖЕ ЕСТЬ следующие вопросы. НЕ дублируй их и не создавай аналогичные формулировки:\n${existingSlice
          .map((q, i) => `${i + 1}. ${q}`)
          .join('\n')}`;
      }
    }

    // 4. Call Gemini
    const aiText = await callGemini({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction,
      temperature: 0.3,
      responseMimeType: 'application/json',
      timeoutMs: 30000,
    });

    let rawQuestions: any[];
    try {
      rawQuestions = JSON.parse(aiText);
    } catch {
      return NextResponse.json(
        { error: 'Не удалось разобрать структурированный ответ ИИ. Попробуйте еще раз.' },
        { status: 502 }
      );
    }

    if (!Array.isArray(rawQuestions)) {
      return NextResponse.json(
        { error: 'ИИ вернул ответ в некорректном формате (ожидался список вопросов).' },
        { status: 502 }
      );
    }

    // 5. Strict Validation and Deduplication
    const validQuestions: ParsedQuestion[] = [];
    const existingPool = Array.isArray(existingQuestions)
      ? existingQuestions.filter((q) => typeof q === 'string')
      : [];

    for (const item of rawQuestions) {
      if (!item || typeof item !== 'object') continue;

      const qText = typeof item.text === 'string' ? item.text.trim() : '';
      if (!qText || qText.length < 5) continue;

      // Check deduplication against existing questions and currently collected questions
      const isDuplicate =
        existingPool.some((ex) => isTooSimilar(qText, ex)) ||
        validQuestions.some((v) => isTooSimilar(qText, v.text));

      if (isDuplicate) {
        console.warn('Skipping duplicate question:', qText);
        continue;
      }

      // Validate options
      if (!Array.isArray(item.options)) continue;

      // Clean & deduplicate options within question
      const cleanOptions: string[] = [];
      const seenOpts = new Set<string>();

      for (const opt of item.options) {
        if (typeof opt !== 'string') continue;
        const trimmed = opt.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (!seenOpts.has(lower)) {
          seenOpts.add(lower);
          cleanOptions.push(trimmed);
        }
      }

      if (cleanOptions.length < 2) continue;

      // Validate correct_answers
      if (!Array.isArray(item.correct_answers) || item.correct_answers.length === 0) continue;

      const validAnswers: string[] = [];
      for (const ans of item.correct_answers) {
        if (typeof ans !== 'string') continue;
        const trimmedAns = ans.trim();
        // Exact match in cleanOptions
        const matched = cleanOptions.find(
          (o) => o === trimmedAns || o.toLowerCase() === trimmedAns.toLowerCase()
        );
        if (matched && !validAnswers.includes(matched)) {
          validAnswers.push(matched);
        }
      }

      if (validAnswers.length === 0) continue;

      // Validate metadata
      const rawMeta = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
      const metadata: QuestionMetadata = {
        subject: typeof rawMeta.subject === 'string' ? rawMeta.subject.trim() : undefined,
        topic: typeof rawMeta.topic === 'string' ? rawMeta.topic.trim() : cleanTopic || undefined,
        subtopic: typeof rawMeta.subtopic === 'string' ? rawMeta.subtopic.trim() : undefined,
        difficulty: safeDifficulty as 'easy' | 'medium' | 'hard',
        source: cleanSource ? 'Учебный материал' : 'Генерация по теме',
        tags: Array.isArray(rawMeta.tags) ? rawMeta.tags.filter((t: any) => typeof t === 'string') : [],
      };

      const explanation =
        typeof item.explanation === 'string' && item.explanation.trim()
          ? item.explanation.trim()
          : null;

      validQuestions.push({
        text: qText,
        options: cleanOptions,
        correct_answers: validAnswers,
        explanation,
        metadata,
      });

      if (validQuestions.length >= safeCount) break;
    }

    if (validQuestions.length === 0) {
      return NextResponse.json(
        { error: 'Не удалось сформировать валидные вопросы. Попробуйте уточнить тему или предоставить более подробный материал.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      questions: validQuestions,
      generatedCount: validQuestions.length,
      requestedCount: safeCount,
      message:
        validQuestions.length < safeCount
          ? `Успешно подготовлено ${validQuestions.length} из ${safeCount} запрошенных вопросов.`
          : `Успешно создано ${validQuestions.length} вопросов.`,
    });
  } catch (error: any) {
    console.error('AI Generate Route Error:', error);

    if (error.message === 'GEMINI_API_KEY_MISSING') {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY не настроен на сервере' },
        { status: 500 }
      );
    }

    if (error.message === 'GEMINI_RATE_LIMIT') {
      return NextResponse.json(
        { error: 'Сервер ИИ временно перегружен. Пожалуйста, подождите 10 секунд и повторите запрос.' },
        { status: 429 }
      );
    }

    if (error.message === 'GEMINI_TIMEOUT') {
      return NextResponse.json(
        { error: 'Время ожидания ответа ИИ истекло. Попробуйте сгенерировать меньшее число вопросов.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Ошибка сервера при генерации вопросов' },
      { status: 500 }
    );
  }
}
