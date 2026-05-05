import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: 'Quiz Trainer',
  description: 'Prepare for exams by generating and taking custom quizzes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${montserrat.variable} h-full`}>
      <body className="h-full bg-zinc-950 text-white antialiased font-[var(--font-montserrat)]">
        {children}
      </body>
    </html>
  );
}
