// ─── Domain types matching Supabase table columns exactly ────────────────────

export interface QuizRow {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
}

export type QuestionType = 'single' | 'multiple';

export interface QuestionRow {
  id: string;
  quiz_id: string;
  text: string;
  options: string[];         // e.g. ["Paris", "London", "Berlin"]
  correct_answers: string[]; // subset of options
  order: number;
}

export interface AttemptRow {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;                           // 0–100
  wrong_questions: string[];               // array of question IDs
  answers: Record<string, string[]>;       // { [questionId]: selectedOptions }
  completed_at: string;
}

// ─── Insert types ─────────────────────────────────────────────────────────────

export type InsertQuiz = Pick<QuizRow, 'title' | 'created_by'>;

export type InsertQuestion = Omit<QuestionRow, 'id'>;

export type InsertAttempt = Omit<AttemptRow, 'id' | 'completed_at'>;

// ─── Supabase Database schema (for createClient<Database>()) ──────────────────

export interface Database {
  public: {
    Tables: {
      quizzes: {
        Row: QuizRow;
        Insert: InsertQuiz;
        Update: Partial<Pick<QuizRow, 'title'>>;
      };
      questions: {
        Row: QuestionRow;
        Insert: InsertQuestion;
        Update: Partial<InsertQuestion>;
      };
      attempts: {
        Row: AttemptRow;
        Insert: InsertAttempt;
        Update: Partial<InsertAttempt>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
