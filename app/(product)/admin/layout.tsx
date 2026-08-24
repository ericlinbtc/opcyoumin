import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { readSession } from '@/server/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');
  if (!['city_admin', 'platform_admin', 'editor'].includes(session.role)) redirect('/me');
  return children;
}
