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
export function parseQuizText(raw: string): ParseResult {
  const errors: string[] = [];
  const questions: ParsedQuestion[] = [];

  // Split into blocks on blank lines
  const blocks = raw
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return { questions: [], errors: ['Input is empty.'] };
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
      errors.push(`Block ${blockNum}: Missing Q: line.`);
      return;
    }
    if (!options || options.length < 2) {
      errors.push(`Block ${blockNum}: A: must have at least 2 options separated by "|".`);
      return;
    }
    if (!correct_answers || correct_answers.length === 0) {
      errors.push(`Block ${blockNum}: Missing C: line.`);
      return;
    }

    // Verify each correct answer exists in options
    const invalid = correct_answers.filter((ca) => !options!.includes(ca));
    if (invalid.length > 0) {
      errors.push(
        `Block ${blockNum}: Correct answer(s) [${invalid.join(', ')}] not found in A: options. ` +
        `Check spelling — must match exactly.`
      );
      return;
    }

    questions.push({ text, options, correct_answers });
  });

  return { questions, errors };
}
