import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getInsight } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const item = await getInsight(slug); return item ? { title: `${item.title}｜游民洞察`, description: item.summary } : {}; }
export default async function InsightDetail({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = await getInsight(slug); if (!item) notFound(); return <main className="article-page insight-article-page"><header className="article-hero"><Link href="/insights">← 返回洞察</Link><span className="knowledge-tag">{item.category} · {item.date} · 重要度 {item.importance}</span><h1>{item.title}</h1><p>{item.summary}</p></header><article className="article-body">{item.body ? <p className="article-lead">{item.body}</p> : <><p className="article-lead">把每天发生的 AI 变化转化为对一人公司真正有用的判断。</p><h2>核心判断</h2><p>产品价值不只来自模型输出，也来自稳定的数据边界、可追溯操作与故障恢复能力。</p><h2>对 OPC 的意义</h2><p>小团队应优先选择可运营、可度量的自动化环节，避免在基础业务闭环之前堆叠复杂智能体。</p></>}</article></main>; }
