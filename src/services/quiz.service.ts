import { supabase } from '@/lib/supabase';
import type { QuizRow, QuestionRow, InsertQuiz, InsertQuestion } from '@/types';

export const quizService = {
  async getByUser(userId: string): Promise<QuizRow[]> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async getById(id: string): Promise<QuizRow | null> {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return data;
  },

  async create(payload: InsertQuiz): Promise<QuizRow> {
    const { data, error } = await supabase
      .from('quizzes')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id: string, payload: Partial<InsertQuiz>): Promise<QuizRow> {
    const { data, error } = await supabase
      .from('quizzes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ─── Questions ─────────────────────────────────────────────────────────────

  async getQuestions(quizId: string): Promise<QuestionRow[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order', { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  },

  async createQuestions(questions: InsertQuestion[]): Promise<QuestionRow[]> {
    const { data, error } = await supabase
      .from('questions')
      .insert(questions)
      .select();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteQuestions(quizId: string): Promise<void> {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('quiz_id', quizId);
    if (error) throw new Error(error.message);
  },
};
