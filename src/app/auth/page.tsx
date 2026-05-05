import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';

export const metadata: Metadata = {
  title: 'Вход — Quiz Trainer',
};

export default function AuthPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-12 text-center">
        <span className="text-lg font-semibold tracking-tight">Quiz Trainer</span>
      </div>
      <AuthForm />
    </div>
  );
}
