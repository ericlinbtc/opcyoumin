import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteNavigation } from '@/components/site-navigation';
import { readSession } from '@/server/auth/session';

export async function ProductShell({ children }: { children: ReactNode }) {
  const session = await readSession();
  return (
    <div className="site-app">
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="游民首页">
            <span className="brand-mark" aria-hidden="true"><i /></span>
          </Link>
          <SiteNavigation />
          <div className="header-actions">
            {session ? (
              <div className="user-menu">
                <Link className="user-avatar user-avatar-initial" href="/me" aria-label="打开个人中心">我</Link>
                <div className="user-menu-panel" aria-label="个人功能">
                  <Link href="/me">个人主页</Link>
                  <Link href="/me/activities">我的活动</Link>
                  <form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">退出</button></form>
                </div>
              </div>
            ) : <Link className="login-button" href="/login">登录 / 注册</Link>}
          </div>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="site-footer-row">
          <Link className="site-footer-home" href="/">游民</Link>
          <span>Copyright © 2026</span>
          <div className="site-footer-links" aria-label="网站信息">
            <Link href="/help#about">关于我们</Link>
            <Link href="/help#privacy">隐私政策</Link>
            <Link href="/help#risk">风险提示</Link>
            <Link href="/help#cooperation">商务合作</Link>
          </div>
          <span className="site-footer-record">ICP备案号：待补充</span>
        </div>
      </footer>
    </div>
  );
}

export function PageHero({ eyebrow, title, description, count = '694', unit = 'OPC 城市社区', tone }: { eyebrow: string; title: string; description: string; count?: string; unit?: string; tone?: string }) {
  return (
    <header className={`feature-page-hero${tone ? ` ${tone}` : ''}`}>
      <div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div>
      <div className="feature-hero-count"><strong>{count}</strong><span>{unit}</span></div>
    </header>
  );
}
