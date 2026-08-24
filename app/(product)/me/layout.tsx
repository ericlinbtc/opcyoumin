import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { readSession } from '@/server/auth/session';

export default async function MeLayout({ children }: { children: ReactNode }) {
  if (!await readSession()) redirect('/login');
  return children;
}
