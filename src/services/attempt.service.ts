import { supabase } from '@/lib/supabase';
import type { AttemptRow, InsertAttempt } from '@/types';

export const attemptService = {
  async create(payload: InsertAttempt): Promise<AttemptRow> {
    const { data, error } = await supabase
      .from('attempts')
      // @ts-ignore
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getById(id: string): Promise<AttemptRow | null> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return data;
  },

  async getByUser(userId: string): Promise<AttemptRow[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Calculates score as a percentage of correct answers.
   * A question is "correct" if selected answers exactly match correct_answers.
   */
  calculateScore(
    answers: Record<string, string[]>,
    questions: { id: string; correct_answers: string[] }[]
  ): { score: number; wrongIds: string[] } {
    let correct = 0;
    const wrongIds: string[] = [];

    for (const q of questions) {
      const selected = answers[q.id] ?? [];
      const isCorrect =
        selected.length === q.correct_answers.length &&
        q.correct_answers.every((a) => selected.includes(a));
      if (isCorrect) {
        correct++;
      } else {
        wrongIds.push(q.id);
      }
    }

    const score = questions.length > 0
      ? Math.round((correct / questions.length) * 100)
      : 0;

    return { score, wrongIds };
  },
};
