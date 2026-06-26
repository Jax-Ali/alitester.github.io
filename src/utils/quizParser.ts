export interface ParsedQuestion {
  text: string;
  options: string[];
  correct_answers: string[];
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
}

/**
 * Parses a plain-text quiz definition into structured question objects.
 *
 * Expected format (one block per question, blank line between blocks):
 *   Q: What is 1 + 2?
 *   A: 1 | 2 | 3 | 4
 *   C: 3
 *
 * Rules:
 *   - Q: question text (required)
 *   - A: answer options separated by " | " (required, 2–6 options)
 *   - C: correct answer(s) separated by " , " (required, must match option text exactly)
 *   - Multiple correct answers: C: Paris, London
 *   - Order of Q/A/C within a block doesn't matter
 */
export function parseQACQuizText(raw: string): ParseResult {
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];

  // Split into blocks on blank lines
  const blocks = raw
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return { questions: [], errors: ['Текст пуст.'] };
  }

  blocks.forEach((block, i) => {
    const blockNum = i + 1;
    const lines = block.split('\n').map((l) => l.trim());

    let text: string | null = null;
    let options: string[] | null = null;
    let correct_answers: string[] | null = null;

    for (const line of lines) {
      if (/^Q:/i.test(line)) {
        text = line.replace(/^Q:\s*/i, '').trim();
      } else if (/^A:/i.test(line)) {
        options = line
          .replace(/^A:\s*/i, '')
          .split('|')
          .map((o) => o.trim())
          .filter(Boolean);
      } else if (/^C:/i.test(line)) {
        const cText = line.replace(/^C:\s*/i, '').trim();
        
        // If the entire C text perfectly matches a single option, don't split it.
        // This solves the bug where a single option containing commas was incorrectly split.
        if (options && options.includes(cText)) {
          correct_answers = [cText];
        } else if (cText.includes('|')) {
          // If they used pipe separator for multiple answers
          correct_answers = cText.split('|').map((c) => c.trim()).filter(Boolean);
        } else {
          // Fallback: split by comma for multiple correct answers
          correct_answers = cText.split(',').map((c) => c.trim()).filter(Boolean);
        }
      }
    }

    // Validate
    if (!text) {
      errors.push(`Блок ${blockNum}: Пропущена строка Q:`);
      return;
    }
    if (!options || options.length < 2) {
      errors.push(`Блок ${blockNum}: Строка A: должна содержать как минимум 2 варианта ответа, разделенных символом "|".`);
      return;
    }
    if (!correct_answers || correct_answers.length === 0) {
      errors.push(`Блок ${blockNum}: Пропущена строка C:`);
      return;
    }

    // Verify each correct answer exists in options
    const invalid = correct_answers.filter((ca) => !options!.includes(ca));
    if (invalid.length > 0) {
      errors.push(
        `Блок ${blockNum}: Правильные ответы [${invalid.join(', ')}] не найдены среди вариантов A:. ` +
        `Проверьте орфографию — должно совпадать один в один.`
      );
      return;
    }

    questions.push({ text, options, correct_answers });
  });

  return { questions, errors };
}

export function parseQuizText(raw: string): ParseResult {
  // 1. Try QAC strict format first
  const qacResult = parseQACQuizText(raw);
  if (qacResult.errors.length === 0 && qacResult.questions.length > 0) {
    return qacResult;
  }

  // 2. Smart Parser for University Formats (Platonus, numbered lists, etc.)
  const questions: ParsedQuestion[] = [];
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  let currentQuestion: {
    text: string;
    options: { text: string; isCorrect: boolean }[];
    platonusCorrectCount?: number;
  } | null = null;

  const commitQuestion = () => {
    if (currentQuestion && currentQuestion.options.length >= 2) {
      // Resolve Platonus format: first N options are correct
      if (currentQuestion.platonusCorrectCount !== undefined && currentQuestion.platonusCorrectCount > 0) {
        for (let i = 0; i < currentQuestion.platonusCorrectCount && i < currentQuestion.options.length; i++) {
          currentQuestion.options[i].isCorrect = true;
        }
      }

      const correct_answers = currentQuestion.options
        .filter(o => o.isCorrect)
        .map(o => o.text);

      questions.push({
        text: currentQuestion.text,
        options: currentQuestion.options.map(o => o.text),
        correct_answers: correct_answers.length > 0 ? correct_answers : ['[УКАЖИТЕ ПРАВИЛЬНЫЙ ОТВЕТ]']
      });
    }
    currentQuestion = null;
  };

  const isQuestionStart = (line: string) => {
    return /^(Question\s*\d+|Вопрос\s*\d+|\d+[\.)]\s+|<question\d*>)/i.test(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isQuestionStart(line)) {
      commitQuestion();
      
      let text = line;
      let platonusCorrectCount = 0;

      const platonusMatch = line.match(/^(?:Question|Вопрос)\s*(\d+)/i);
      const qTagMatch = line.match(/^<question(\d*)>/i);

      if (platonusMatch) {
        platonusCorrectCount = parseInt(platonusMatch[1], 10);
        // If the line is purely "Question 2", the REAL question text is the next line
        if (line.replace(/^(?:Question|Вопрос)\s*\d+/i, '').trim() === '') {
          i++;
          if (i < lines.length) {
            text = lines[i];
          }
        } else {
          text = line.replace(/^(?:Question|Вопрос)\s*\d+[:\.\-]?\s*/i, '');
        }
      } else if (qTagMatch) {
        platonusCorrectCount = qTagMatch[1] ? parseInt(qTagMatch[1], 10) : 1;
        text = line.replace(/^<question\d*>\s*/i, '');
      } else {
        // Standard numbered list "1. What is..."
        text = line.replace(/^\d+[\.)]\s*/, '');
      }

      currentQuestion = {
        text,
        options: [],
        platonusCorrectCount
      };
    } else {
      if (!currentQuestion) {
        // Ignore floating text before the first question starts
        continue;
      } else {
        // It's an option
        let isCorrect = false;
        let optText = line;

        // Check for <variantright> and <variant> tags
        if (/^<variantright>/i.test(optText)) {
          isCorrect = true;
          optText = optText.replace(/^<variantright>\s*/i, '');
        } else if (/^<variant>/i.test(optText)) {
          optText = optText.replace(/^<variant>\s*/i, '');
        }

        // Check for markers: +, *, [x], (x), v), V)
        const markerMatch = optText.match(/^([+*]|\[x\]|\(x\)|v\)|V\))\s*/i);
        if (markerMatch) {
          isCorrect = true;
          optText = optText.substring(markerMatch[0].length).trim();
        }

        // Clean up leading letters like A), B), a., b.
        optText = optText.replace(/^[a-eA-Eа-яА-Я][\.)]\s*/, '');

        currentQuestion.options.push({ text: optText, isCorrect });
      }
    }
  }
  commitQuestion();

  if (questions.length === 0) {
    // If smart parser also failed entirely, fallback to QAC errors so the user sees something
    return qacResult;
  }

  return { questions, errors: [] };
}
