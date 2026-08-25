import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/rich-text';
import { createPageMetadata } from '@/lib/seo';
import { getKnowledge } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = await getKnowledge((await params).slug);
  return item ? createPageMetadata({ title: `${item.title}｜游民知识`, description: item.summary, canonical: `/knowledge/${item.slug}`, useBrandImage: false }) : {};
}

export default async function KnowledgeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getKnowledge(slug);
  if (!item) notFound();
  return <main className="article-page"><header className="article-hero"><Link href="/knowledge">← 返回知识</Link><span className="knowledge-tag">{item.category} · 系统知识</span><h1>{item.title}</h1><p>{item.summary}</p></header><article className="article-body"><p className="reading-byline">{item.author ?? '游民编辑部'}{item.updatedAt ? ` · 更新于 ${item.updatedAt.toLocaleDateString('zh-CN')}` : ''}{item.factCheckedAt ? ` · 核验于 ${item.factCheckedAt.toLocaleDateString('zh-CN')}` : ''}</p>{item.body ? <RichText body={item.body} /> : <p className="article-lead">内容正在整理中。</p>}{item.sourceUrl ? <footer><span>来源：{item.sourceName ?? '原始资料'}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 ↗</a></footer> : null}</article></main>;
}
