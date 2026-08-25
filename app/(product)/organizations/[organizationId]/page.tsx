import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrganizationControls } from '@/features/organizations/organization-controls';
import { createPageMetadata } from '@/lib/seo';
import { readSession } from '@/server/auth/session';
import { getPublicOrganization, listOrganizationMembers } from '@/server/repositories/organizations';

export async function generateMetadata({ params }: { params: Promise<{ organizationId: string }> }): Promise<Metadata> {
  const item = await getPublicOrganization((await params).organizationId);
  return item ? createPageMetadata({ title: `${item.name}｜游民城市机构`, description: item.summary, canonical: `/organizations/${item.id}`, useBrandImage: false }) : {};
}

export default async function OrganizationDetailPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const session = await readSession();
  const organization = await getPublicOrganization(organizationId, session?.id);
  if (!organization) notFound();
  const members = await listOrganizationMembers(organizationId);
  return <main className="reading-page"><Link className="back-link" href="/organizations">← 返回机构列表</Link><article className="directory-detail-box organization-detail-box"><div className="directory-detail-head"><div><small>{organization.category} · {organization.city}</small><h1>{organization.name}</h1></div></div><div className="organization-detail-hero"><strong>{organization.memberCount}</strong><span>位社区成员正在共同参与</span></div><div className="directory-detail-content"><p>{organization.summary}</p><div className="directory-detail-facts"><span><small>关注领域</small><b>{organization.category}</b></span><span><small>所在城市</small><b>{organization.city}</b></span><span><small>活动地点</small><b>{organization.location}</b></span></div>{session ? <OrganizationControls organizationId={organization.id} membershipRole={organization.membershipRole} applicationId={organization.applicationId} applicationStatus={organization.applicationStatus} /> : <Link className="primary-product-button" href="/login">登录后申请加入</Link>}<section className="member-posts" aria-labelledby="organization-members"><div className="account-section-head"><h2 id="organization-members">机构成员</h2><span>{members.length} 位公开成员</span></div>{members.length ? <div className="member-post-list">{members.map((member) => <article key={member.id}><small>{member.role} · 加入于 {member.joinedAt.toLocaleDateString('zh-CN')}</small><p><Link href={`/members/${member.id}`}>{member.nickname}</Link></p></article>)}</div> : <p className="empty-state">暂无公开成员记录。</p>}</section></div></article></main>;
}
