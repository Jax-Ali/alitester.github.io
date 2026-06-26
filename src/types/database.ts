// ─── Domain types matching Supabase table columns exactly ────────────────────

export interface FolderRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface QuizRow {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  folder_id: string | null;
  tags: string[];
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

export interface UserRow {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

// ─── Insert types ─────────────────────────────────────────────────────────────

export type InsertQuiz = Pick<QuizRow, 'title' | 'created_by'> & Partial<Pick<QuizRow, 'folder_id' | 'tags'>>;

export type InsertFolder = Pick<FolderRow, 'name' | 'created_by'>;

export type InsertQuestion = Omit<QuestionRow, 'id'>;

export type InsertAttempt = Omit<AttemptRow, 'id' | 'completed_at'>;

// ─── Supabase Database schema (for createClient<Database>()) ──────────────────

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Partial<UserRow>;
        Update: Partial<UserRow>;
        Relationships: any[];
      };
      folders: {
        Row: FolderRow;
        Insert: InsertFolder;
        Update: Partial<Pick<FolderRow, 'name'>>;
        Relationships: any[];
      };
      quizzes: {
        Row: QuizRow;
        Insert: InsertQuiz;
        Update: Partial<Pick<QuizRow, 'title' | 'folder_id' | 'tags'>>;
        Relationships: any[];
      };
      questions: {
        Row: QuestionRow;
        Insert: InsertQuestion;
        Update: Partial<InsertQuestion>;
        Relationships: any[];
      };
      attempts: {
        Row: AttemptRow;
        Insert: InsertAttempt;
        Update: Partial<InsertAttempt>;
        Relationships: any[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
