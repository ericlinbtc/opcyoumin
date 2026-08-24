import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getKnowledge } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const item = await getKnowledge(slug); return item ? { title: `${item.title}｜游民知识库`, description: item.summary } : {}; }
export default async function KnowledgeDetail({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = await getKnowledge(slug); if (!item) notFound(); return <main className="article-page"><header className="article-hero"><Link href="/knowledge">← 返回知识</Link><span className="knowledge-tag">{item.category} · 系统知识</span><h1>{item.title}</h1><p>{item.summary}</p></header><article className="article-body">{item.body ? <p className="article-lead">{item.body}</p> : <><p className="article-lead">从一个真实、具体且能够完成验收的问题开始，把经验转化为可以重复使用的方法。</p><h2>从一个明确问题开始</h2><p>记录假设、交付过程和用户反馈，再决定下一次投入。</p><h2>形成稳定闭环</h2><p>每一次功能扩展都必须同时具备权限、状态、错误、监控与恢复路径。</p></>}</article></main>; }
