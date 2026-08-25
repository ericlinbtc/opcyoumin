import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/product-shell';
import { createPageMetadata } from '@/lib/seo';
import { readSession } from '@/server/auth/session';
import { listPublicOrganizations } from '@/server/repositories/organizations';

export const metadata: Metadata = createPageMetadata({ title: '城市机构｜游民', description: '发现并申请加入 OPC 城市机构。', canonical: '/organizations' });
export const dynamic = 'force-dynamic';

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ q?: string; cityId?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const cityId = params.cityId?.trim() || undefined;
  const page = Math.max(Number.parseInt(params.page ?? '1', 10) || 1, 1);
  const pageSize = 24;
  const session = await readSession();
  const items = await listPublicOrganizations({ query, cityId, viewerId: session?.id, limit: pageSize + 1, offset: (page - 1) * pageSize });
  const hasNext = items.length > pageSize;
  const visible = items.slice(0, pageSize);
  const pageHref = (nextPage: number) => `/organizations?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(cityId ? { cityId } : {}), page: String(nextPage) })}`;

  return <main className="feature-page"><PageHero eyebrow="CITY ORGANIZATIONS" title="城市机构" description="查看城市共建空间、行业小组与社区组织，提交申请并跟踪审核进度。" count={String(visible.length)} unit="个机构" tone="knowledge-hero" /><section className="feature-page-body"><form className="catalog-search" action="/organizations"><label htmlFor="organization-search">搜索机构</label><div><input id="organization-search" name="q" defaultValue={query} placeholder="输入机构名称" />{cityId && <input type="hidden" name="cityId" value={cityId} />}<button type="submit">搜索</button></div></form><div className="organization-directory">{visible.map((organization) => <article className="organization-list-card" key={organization.id}><div className="organization-list-body"><div className="directory-meta"><span>{organization.category}</span><b>{organization.city}</b></div><h3>{organization.name}</h3><p>{organization.summary}</p><div className="organization-summary"><span><b>{organization.memberCount}</b> 位成员</span><span>{organization.location}</span></div><Link className="directory-link" href={`/organizations/${organization.id}`}>{organization.membershipRole ? '查看机构与成员' : ['submitted', 'reviewing'].includes(organization.applicationStatus ?? '') ? '查看申请进度' : '查看机构详情'} →</Link></div></article>)}</div>{visible.length === 0 && <p className="empty-state">没有找到符合条件的机构。</p>}<nav className="directory-pagination" aria-label="机构分页">{page > 1 && <Link href={pageHref(page - 1)}>← 上一页</Link>}{hasNext && <Link href={pageHref(page + 1)}>下一页 →</Link>}</nav></section></main>;
}
