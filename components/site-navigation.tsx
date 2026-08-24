'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/cities', label: '社区', matches: ['/cities', '/posts', '/members', '/activities'] },
  { href: '/knowledge', label: '知识', matches: ['/knowledge'] },
  { href: '/insights', label: '洞察', matches: ['/insights'] },
  { href: '/help', label: '帮助', matches: ['/help'] },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航">
      {navigation.map((item) => {
        const active = item.matches.some((prefix) => pathname.startsWith(prefix));
        return <Link className={active ? 'active' : undefined} href={item.href} key={item.href}>{item.label}</Link>;
      })}
    </nav>
  );
}
