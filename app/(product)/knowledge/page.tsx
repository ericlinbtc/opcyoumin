import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/product-shell';
import { listKnowledge } from '@/server/repositories/public-content';

export const metadata: Metadata = { title: 'OPC 知识库｜游民', description: '面向一人公司创业者的知识内容。' };
export const dynamic = 'force-dynamic';
export default async function KnowledgePage() {
  const knowledgeItems = await listKnowledge();
  return <main className="feature-page knowledge-center"><PageHero eyebrow="OPC AI KNOWLEDGE" title="知识" description="从基础概念到可执行的 AI 工作方法，建立一人公司真正用得上的知识体系。" count={String(knowledgeItems.length)} unit="篇系统知识" /><section className="feature-page-body"><div className="knowledge-grid">{knowledgeItems.map((item, index) => <article key={item.slug}><span className="knowledge-no">{String(index + 1).padStart(2, '0')}</span><div className="knowledge-tag">{item.category}</div><h3>{item.title}</h3><p>{item.summary}</p><footer><span>系统知识</span><Link href={`/knowledge/${item.slug}`}>阅读全文 <span aria-hidden="true">→</span></Link></footer></article>)}</div>{knowledgeItems.length === 0 && <p className="empty-state">知识内容正在整理中。</p>}</section></main>;
}
