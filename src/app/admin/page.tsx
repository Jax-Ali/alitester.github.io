'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import type { UserRow, QuizRow } from '@/types/database';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userQuizzes, setUserQuizzes] = useState<QuizRow[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth');
        return;
      }
      
      // Check if the current user is an admin
      supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data?.is_admin) {
            router.push('/dashboard');
          } else {
            // Fetch all users
            supabase
              .from('users')
              .select('*')
              .order('created_at', { ascending: false })
              .then(({ data: allUsers }) => {
                setUsers(allUsers || []);
                setLoading(false);
              });
          }
        });
    });
  }, [router]);

  useEffect(() => {
    if (selectedUserId) {
      supabase
        .from('quizzes')
        .select('*')
        .eq('created_by', selectedUserId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setUserQuizzes(data || []);
        });
    } else {
      setUserQuizzes([]);
    }
  }, [selectedUserId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 flex flex-col md:flex-row gap-8 items-start">
        {/* Users List */}
        <div className="flex-1 w-full">
          <h1 className="text-xl font-semibold mb-6">Users</h1>
          <div className="border border-white/10 rounded-xl overflow-hidden overflow-x-auto bg-white/[0.02]">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-white/5 border-b border-white/10 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`cursor-pointer transition-colors hover:bg-white/5 ${
                      selectedUserId === u.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          u.is_admin
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-white/5 text-zinc-400 border border-white/10'
                        }`}
                      >
                        {u.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Details / Quizzes */}
        <div className="flex-1 w-full">
          {selectedUserId ? (
            <div className="sticky top-10">
              <h2 className="text-xl font-semibold mb-6">User Quizzes</h2>
              {userQuizzes.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <p className="text-sm text-zinc-500">This user has no quizzes yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {userQuizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="bg-white/5 border border-white/10 p-4 rounded-xl flex justify-between items-center transition-colors hover:border-white/20"
                    >
                      <div>
                        <p className="text-sm text-white font-medium">{quiz.title}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(quiz.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/quiz/${quiz.id}`)}
                        className="text-xs bg-white text-zinc-900 px-4 py-2 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
                      >
                        Open
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-center text-zinc-500 py-20 border border-dashed border-white/10 rounded-xl mt-[52px]">
              Select a user from the list to view their quizzes.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
