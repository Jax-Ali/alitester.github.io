import { ReactNode } from 'react';

interface MainContainerProps {
  children: ReactNode;
}

export const MainContainer = ({ children }: MainContainerProps) => {
  return (
    <main className="container mx-auto px-4 py-8 flex-1 flex flex-col">
      {children}
    </main>
  );
};
