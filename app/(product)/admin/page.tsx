import Link from 'next/link';
import { requireSession } from '@/server/auth/session';

const modules = [
  ['users', '用户与角色'],
  ['posts', '内容与举报'],
  ['activities', '活动审核'],
  ['content', '知识与洞察'],
  ['cities', '城市管理'],
  ['applications', '申请与工单'],
  ['operations', '任务与死信'],
  ['audit', '操作审计'],
] as const;

export default async function AdminPage() {
  const session = await requireSession(['editor', 'city_admin', 'platform_admin']);
  const visible = modules.filter(([slug]) => session.role === 'platform_admin' || (session.role === 'editor' ? slug === 'content' : ['posts', 'activities', 'cities'].includes(slug)));
  return <main><header className="product-hero admin-hero"><small>OPERATIONS CONSOLE</small><h1>运营管理后台</h1><p>所有写操作都经过服务端授权并记录不可修改的审计事件。</p></header><section className="product-section"><div className="product-card-grid">{visible.map(([slug, label]) => <Link className="product-card compact-card" href={`/admin/${slug}`} key={slug}><small>ADMIN</small><h2>{label}</h2><span>进入管理 →</span></Link>)}</div></section></main>;
}
