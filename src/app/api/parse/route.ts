import { NextResponse } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const prompt = `Преобразуй следующий текст теста в строгий JSON формат массива объектов. 
Требования:
- Каждый объект должен иметь поля: "text" (строка, сам вопрос), "options" (массив строк, варианты ответов), "correct_answers" (массив строк, правильные ответы).
- Если правильный ответ в тексте никак не отмечен, оставь массив "correct_answers" ПУСТЫМ [].
- Выведи ТОЛЬКО чистый JSON, без маркдауна и блоков \`\`\`json.
Текст:
"""
${text}
"""`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for deterministic formatting
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini API Error:', err);
      return NextResponse.json({ error: 'Failed to communicate with AI provider' }, { status: 502 });
    }

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Clean up markdown just in case the AI ignored instructions
    resultText = resultText.replace(/^```json/i, '').replace(/```$/i, '').trim();

    const parsedData = JSON.parse(resultText);

    if (!Array.isArray(parsedData)) {
      throw new Error("AI didn't return an array");
    }

    // Process empty answers to our placeholder
    const standardized = parsedData.map((q: any) => ({
      ...q,
      correct_answers: Array.isArray(q.correct_answers) && q.correct_answers.length > 0 
        ? q.correct_answers 
        : ['[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]']
    }));

    return NextResponse.json({ questions: standardized });

  } catch (error: any) {
    console.error('Parse API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
