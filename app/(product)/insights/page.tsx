import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/product-shell';
import { createPageMetadata } from '@/lib/seo';
import { listInsights } from '@/server/repositories/public-content';

export const metadata: Metadata = createPageMetadata({ title: 'AI 洞察｜游民', description: '按日期、分类和重要程度整理的 AI 与 OPC 洞察。', canonical: '/insights' });
export const dynamic = 'force-dynamic';
export default async function InsightsPage() {
  const insightItems = await listInsights();
  return <main className="feature-page insight-daily"><PageHero eyebrow="OPC AI DAILY" title="洞察" description="每天筛选真正值得关注的 AI 动态，用几分钟掌握变化、判断影响、找到行动方向。" count={String(insightItems.length).padStart(2, '0')} unit="条 AI 洞察" /><section className="feature-page-body insight-body"><div className="daily-edition" aria-label="洞察摘要"><div><small>DAILY · 2026</small><strong>今日 AI 与 OPC 信号</strong></div><p>从信息变化中提炼对一人公司真正有用的判断，并给出可执行的下一步。</p><span>持续更新</span></div><div className="insight-list">{insightItems.map((item, index) => <article className={index === 0 ? 'open' : ''} key={item.slug}><div className="insight-time"><b>{item.date.slice(5) || 'TODAY'}</b><span>{String(index + 1).padStart(2, '0')}</span></div><div className="insight-copy"><div className="insight-meta"><span>{item.category}</span><em className={item.importance >= 3 ? 'signal-重要' : item.importance === 2 ? 'signal-关注' : 'signal-速览'}>{item.importance >= 3 ? '重要' : item.importance === 2 ? '关注' : '速览'}</em></div><h2>{item.title}</h2><p>{item.summary}</p><footer><span>游民编辑部整理</span><Link href={`/insights/${item.slug}`}>阅读全文 <span aria-hidden="true">→</span></Link></footer></div></article>)}</div>{insightItems.length === 0 && <p className="empty-state">今日洞察正在整理中。</p>}</section></main>;
}
