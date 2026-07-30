import { type ReactNode } from 'react';
import { Brand } from '@/components/gamecast/brand';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sb-auth-page">
      <header className="sb-auth-header">
        <div className="sb-shell"><Brand /></div>
      </header>
      <main className="sb-auth-main">
        {children}
      </main>
    </div>
  );
}
