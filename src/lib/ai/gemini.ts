const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface GeminiContentPart {
  text: string;
}

export interface GeminiContent {
  parts: GeminiContentPart[];
}

export interface CallGeminiOptions {
  contents: GeminiContent[];
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  timeoutMs?: number;
}

/**
 * Reusable server-side client for Google Gemini API.
 * Keeps API key secure on server and provides deterministic JSON configurations.
 */
export async function callGemini(options: CallGeminiOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 25000);

  try {
    const body: Record<string, any> = {
      contents: options.contents,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        response_mime_type: options.responseMimeType ?? 'application/json',
      },
    };

    if (options.systemInstruction) {
      body.system_instruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error status:', response.status, errorText);
      if (response.status === 429) {
        throw new Error('GEMINI_RATE_LIMIT');
      }
      throw new Error(`GEMINI_API_ERROR_${response.status}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('GEMINI_EMPTY_RESPONSE');
    }

    // Clean up code fences just in case
    return candidateText.replace(/^```json\n?/i, '').replace(/```$/i, '').trim();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('GEMINI_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
