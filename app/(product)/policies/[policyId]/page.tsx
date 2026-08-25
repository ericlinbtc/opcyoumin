import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createPageMetadata } from '@/lib/seo';
import { getPublicPolicy } from '@/server/repositories/policies';

export async function generateMetadata({ params }: { params: Promise<{ policyId: string }> }): Promise<Metadata> {
  const { policyId } = await params;
  const item = await getPublicPolicy(policyId);
  return item ? createPageMetadata({ title: `${item.title}｜政策与解读`, description: item.summary, canonical: `/policies/${item.id}`, useBrandImage: false }) : {};
}

export default async function PolicyDetailPage({ params }: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await params;
  const item = await getPublicPolicy(policyId);
  if (!item) notFound();
  return <main className="reading-page"><Link className="back-link" href="/policies">← 返回政策列表</Link><article className="reading-article"><small>{item.category} · POLICY SOURCE</small><h1>{item.title}</h1><p className="reading-byline">{item.issuingAuthority}{item.documentNumber ? ` · ${item.documentNumber}` : ''} · 发布于 {new Date(item.publishedAt).toLocaleDateString('zh-CN')}</p>{item.supersededAt ? <p className="empty-state">该政策已于 {new Date(item.supersededAt).toLocaleDateString('zh-CN')} 标记为废止或被替代。{item.revisionNote}</p> : null}<p className="lead">{item.summary}</p><dl className="detail-facts"><div><dt>适用地区</dt><dd>{item.city ?? '全国'}</dd></div><div><dt>实施日期</dt><dd>{item.effectiveAt ? new Date(item.effectiveAt).toLocaleDateString('zh-CN') : '以原文为准'}</dd></div><div><dt>官方来源</dt><dd>{item.sourceName}</dd></div><div><dt>来源核验</dt><dd>{item.sourceCheckedAt ? new Date(item.sourceCheckedAt).toLocaleDateString('zh-CN') : '待补充'}</dd></div></dl><div className="reading-body"><h2>游民解读</h2><p>{item.interpretation}</p><h2>重点关注</h2><ul>{item.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>{item.revisionNote ? <><h2>修订说明</h2><p>{item.revisionNote}</p></> : null}<p>政策可能被修订、废止或由地方另行制定实施口径。办理前请打开官方原文并向主管部门核验。</p></div><footer><span>解读更新时间与政策发布日期分开管理，不构成法律、财税或申报承诺。</span><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看官方原文 ↗</a></footer></article></main>;
}
