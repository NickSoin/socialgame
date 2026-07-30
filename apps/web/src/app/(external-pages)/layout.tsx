import Navbar from '@/app/Navbar';
import { Brand } from '@/components/gamecast/brand';
import { type ReactNode, Suspense } from 'react';

export default function ExternalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense
        fallback={
          <header className="sb-header">
            <div className="sb-shell sb-header__inner"><Brand /></div>
          </header>
        }
      >
        <Navbar />
      </Suspense>
      <div>{children}</div>
    </div>
  );
}
