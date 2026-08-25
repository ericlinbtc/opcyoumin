import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/rich-text';
import { createPageMetadata } from '@/lib/seo';
import { getInsight } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = await getInsight((await params).slug);
  return item ? createPageMetadata({ title: `${item.title}｜游民洞察`, description: item.summary, canonical: `/insights/${item.slug}`, useBrandImage: false }) : {};
}

export default async function InsightDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getInsight(slug);
  if (!item) notFound();
  return <main className="article-page insight-article-page"><header className="article-hero"><Link href="/insights">← 返回洞察</Link><span className="knowledge-tag">{item.category} · {item.date} · 重要度 {item.importance}</span><h1>{item.title}</h1><p>{item.summary}</p></header><article className="article-body"><p className="reading-byline">{item.author ?? '游民编辑部'}{item.updatedAt ? ` · 更新于 ${item.updatedAt.toLocaleDateString('zh-CN')}` : ''}{item.factCheckedAt ? ` · 事实核验于 ${item.factCheckedAt.toLocaleDateString('zh-CN')}` : ''}</p><p className="article-lead">AI 洞察经人工编辑与核验，仍可能因信息更新而失效，请以原始来源为准。</p>{item.body ? <RichText body={item.body} /> : <p>正文正在整理中。</p>}{item.sourceUrl ? <footer><span>来源：{item.sourceName ?? '原始资料'}</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看原始来源 ↗</a></footer> : null}</article></main>;
}
