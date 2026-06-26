'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { quizService } from '@/services/quiz.service';
import { folderService } from '@/services/folder.service';
import { Header } from '@/components/layout/Header';
import { QuizCard } from '@/components/quiz/QuizCard';
import type { QuizRow, FolderRow } from '@/types/database';
import { ru } from '@/lib/i18n/ru';

export default function DashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setUserEmail(user.email || '');
      setUserId(user.id);
      Promise.all([
        quizService.getByUser(user.id),
        folderService.getByUser(user.id)
      ]).then(([quizzesData, foldersData]) => {
        setQuizzes(quizzesData);
        setFolders(foldersData);
        setLoading(false);
      });
    });
  }, [router]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const folder = await folderService.create({ name: newFolderName.trim(), created_by: userId });
      setFolders([folder, ...folders]);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      console.error(err);
      alert('Ошибка при создании папки');
    }
  };

  const filteredQuizzes = quizzes.filter(q => 
    selectedFolderId === null ? true : q.folder_id === selectedFolderId
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">{ru.loading}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4">
          <div className="mb-4">
            <h1 className="text-xl font-semibold">{ru.myQuizzes}</h1>
            <p className="text-sm text-zinc-500 mt-0.5 break-all">{userEmail}</p>
          </div>
          
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFolderId === null 
                ? 'bg-white/10 text-white' 
                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            📂 Все тесты
          </button>
          
          <div className="flex flex-col gap-1">
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFolderId(f.id)}
                className={`text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors flex justify-between group ${
                  selectedFolderId === f.id 
                    ? 'bg-white/10 text-white' 
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>📁 {f.name}</span>
              </button>
            ))}
          </div>

          {isCreatingFolder ? (
            <form onSubmit={handleCreateFolder} className="mt-2 flex flex-col gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Имя папки..."
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-medium hover:bg-zinc-200">
                  Создать
                </button>
                <button type="button" onClick={() => setIsCreatingFolder(false)} className="text-xs bg-white/10 text-white px-3 py-1.5 rounded-lg hover:bg-white/20">
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="mt-2 text-left px-4 py-2 text-sm text-zinc-500 hover:text-white transition-colors flex items-center gap-2"
            >
              <span>+ Новая папка</span>
            </button>
          )}
        </aside>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium">
              {selectedFolderId === null 
                ? 'Все тесты' 
                : folders.find(f => f.id === selectedFolderId)?.name || ''}
            </h2>
            <Link
              href="/create"
              className="text-sm px-4 py-2 bg-white text-zinc-900 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
            >
              {ru.newQuiz}
            </Link>
          </div>

          {filteredQuizzes.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-white/10 rounded-xl">
              <p className="text-zinc-500 text-sm">{ru.noQuizzesYet}</p>
              <Link
                href="/create"
                className="inline-block mt-4 text-sm text-zinc-300 hover:text-white underline-offset-2 hover:underline transition-colors"
              >
                {ru.createFirstQuiz}
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredQuizzes.map((quiz) => (
                <QuizCard key={quiz.id} quiz={quiz} folders={folders} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
