import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/product-shell';
import { listPublicPolicies } from '@/server/repositories/policies';

export const metadata: Metadata = { title: '政策与解读｜游民', description: '查看带官方来源、发布机关与日期的 OPC 相关政策。' };
export const dynamic = 'force-dynamic';

export default async function PoliciesPage() {
  const items = await listPublicPolicies();
  return <main className="feature-page"><PageHero eyebrow="POLICY & SOURCE" title="政策与解读" description="每条政策均保留发布机关、发布日期与官方原文。平台解读仅用于信息整理，不替代主管部门答复或专业意见。" count={String(items.length)} unit="条已核验政策" tone="knowledge-hero" /><section className="feature-page-body"><div className="content-list">{items.map((item) => <article key={item.id}><small>{item.category} · {item.issuingAuthority} · {new Date(item.publishedAt).toLocaleDateString('zh-CN')}</small><h3><Link href={`/policies/${item.id}`}>{item.title}</Link></h3><p>{item.summary}</p><Link className="directory-link" href={`/policies/${item.id}`}>阅读政策与解读 →</Link></article>)}</div></section></main>;
}
