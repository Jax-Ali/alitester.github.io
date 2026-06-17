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
    let totalScore = 0;
    const wrongIds: string[] = [];

    for (const q of questions) {
      const selected = answers[q.id] ?? [];
      const correctCount = q.correct_answers.length;
      
      let questionScore = 0;

      if (correctCount > 0) {
        const pointPerAnswer = 1 / correctCount;
        selected.forEach((ans) => {
          if (q.correct_answers.includes(ans)) {
            questionScore += pointPerAnswer; // + for correct
          } else {
            questionScore -= pointPerAnswer; // - for wrong
          }
        });
      }

      // Clamp score between 0 and 1
      questionScore = Math.max(0, Math.min(1, questionScore));
      totalScore += questionScore;

      // If they didn't get full points (accounting for float precision), mark as wrong for the retry loop
      if (questionScore < 0.999) {
        wrongIds.push(q.id);
      }
    }

    const score = questions.length > 0
      ? Math.round((totalScore / questions.length) * 100)
      : 0;

    return { score, wrongIds };
  },
};
