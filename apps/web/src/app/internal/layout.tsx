import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/staging-console.css';

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function InternalLayout({ children }: { children: ReactNode }) {
  return children;
}
