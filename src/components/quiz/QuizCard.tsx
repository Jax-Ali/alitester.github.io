'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { QuizRow, FolderRow } from '@/types';
import { ru } from '@/lib/i18n/ru';
import { quizService } from '@/services/quiz.service';

interface QuizCardProps {
  quiz: QuizRow;
  questionCount?: number;
  folders?: FolderRow[];
}

export function QuizCard({ quiz, questionCount, folders = [] }: QuizCardProps) {
  const [copied, setCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(quiz.folder_id);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    const link = `${window.location.origin}/quiz/${quiz.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    const newFolderId = e.target.value || null;
    setIsUpdating(true);
    try {
      await quizService.update(quiz.id, { folder_id: newFolderId });
      setCurrentFolderId(newFolderId);
    } catch (err) {
      console.error('Failed to update folder', err);
      alert('Ошибка при перемещении теста');
    } finally {
      setIsUpdating(false);
    }
  };

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

      <div className="flex items-center justify-between text-xs text-zinc-600 gap-2">
        <div className="flex items-center gap-2 flex-1">
          <p className="shrink-0">
            {new Date(quiz.created_at).toLocaleDateString('ru-RU', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          {folders.length > 0 && (
            <select
              value={currentFolderId || ''}
              onChange={handleFolderChange}
              disabled={isUpdating}
              className="bg-black/50 border border-white/10 rounded px-2 py-0.5 text-xs text-zinc-400 focus:outline-none w-24 sm:w-auto"
            >
              <option value="">Без папки</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/print/${quiz.id}`}
            target="_blank"
            className="hover:text-white transition-colors"
            title="Распечатать"
          >
            🖨️
          </Link>
          <Link
            href={`/edit/${quiz.id}`}
            className="hover:text-white transition-colors"
            title={ru.editButton}
          >
            ✏️
          </Link>
        </div>
      </div>

      <div className="mt-auto flex gap-2">
        <Link
          href={`/quiz/${quiz.id}`}
          className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition-colors"
        >
          {ru.startQuiz}
        </Link>
        <button
          onClick={handleCopyLink}
          className={`flex-1 text-center text-xs font-medium py-2 rounded-lg border transition-colors ${
            copied
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {copied ? ru.linkCopied : ru.copyLink}
        </button>
      </div>
    </div>
  );
}
