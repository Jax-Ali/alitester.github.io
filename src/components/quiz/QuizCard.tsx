import Link from 'next/link';
import type { QuizRow } from '@/types';
import { ru } from '@/lib/i18n/ru';

interface QuizCardProps {
  quiz: QuizRow;
  questionCount?: number;
}

export function QuizCard({ quiz, questionCount }: QuizCardProps) {
  return (
    <div className="group flex flex-col gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/8 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-white leading-snug line-clamp-2">
          {quiz.title}
        </h3>
        {questionCount !== undefined && (
          <span className="shrink-0 text-xs text-zinc-500 bg-white/5 border border-white/10 rounded-md px-2 py-0.5">
            {questionCount} в.
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-600">
        {new Date(quiz.created_at).toLocaleDateString('ru-RU', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      <Link
        href={`/quiz/${quiz.id}`}
        className="mt-auto w-full text-center text-xs font-medium py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
      >
        {ru.startQuiz}
      </Link>
    </div>
  );
}
