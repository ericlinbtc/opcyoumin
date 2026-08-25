/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlockControl, FollowControl, ReportControl } from '@/features/product-controls';
import { createPageMetadata } from '@/lib/seo';
import { readSession } from '@/server/auth/session';
import { getPublicMemberRelations } from '@/server/repositories/community';
import { getPublicMember, hasBlockRelationship, isBlocked, isFollowing } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const member = await getPublicMember((await params).userId, 1);
  return member ? createPageMetadata({ title: `${member.name}｜游民成员`, description: member.bio || `${member.name}的 OPC 社区主页`, canonical: `/members/${member.id}`, useBrandImage: false }) : {};
}

export default async function MemberPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { userId } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const limit = 20;
  const session = await readSession();
  const relationshipBlocked = session && session.id !== userId ? await hasBlockRelationship(session.id, userId) : false;
  const member = await getPublicMember(userId, limit + 1, (page - 1) * limit);
  if (!member) notFound();
  const [relations, following, blocked] = await Promise.all([
    getPublicMemberRelations(userId),
    session && session.id !== userId && !relationshipBlocked ? isFollowing(session.id, userId) : false,
    session && session.id !== userId ? isBlocked(session.id, userId) : false,
  ]);
  const posts = relationshipBlocked ? [] : member.posts.slice(0, limit);
  return <main className="account-page"><section className="account-content"><Link className="account-back" href="/cities">← 返回社区</Link><div className="member-card route-member-card">{member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name}的头像`} /> : <div className="member-route-avatar" aria-hidden="true">{member.name.slice(0, 1)}</div>}<div className="member-card-copy"><small>OPC 社区成员</small><h1>{member.name}</h1><p>{member.bio || member.occupationTags.join(' · ')}</p><div className="profile-tags">{member.occupationTags.map((tag) => <i key={tag}>{tag}</i>)}</div></div><dl><div><dt>{relations.followerCount}</dt><dd>关注者</dd></div><div><dt>{relations.followingCount}</dt><dd>关注中</dd></div><div><dt>{relations.cities.length}</dt><dd>加入城市</dd></div></dl><div className="member-follow-zone">{session ? session.id !== userId && <div className="member-action-stack">{!relationshipBlocked && <FollowControl memberId={userId} initialFollowing={following} />}<BlockControl memberId={userId} initialBlocked={blocked} /><ReportControl targetType="user" targetId={userId} /></div> : <Link href="/login">登录后关注</Link>}</div></div>
    {relationshipBlocked ? <p className="empty-state">由于屏蔽关系，双方的公开动态不再展示。</p> : <><section className="member-posts"><div className="account-section-head"><h2>公开资料</h2><span>社区关系</span></div><div className="detail-facts"><div><dt>加入城市</dt><dd>{relations.cities.length ? relations.cities.map((city) => <Link href={`/cities/${city.slug}`} key={city.id}>{city.name} </Link>) : '暂未公开'}</dd></div><div><dt>发起活动</dt><dd>{relations.organizedActivities.length}</dd></div><div><dt>参与活动</dt><dd>{relations.participatedActivities.length}</dd></div></div>{[...relations.organizedActivities, ...relations.participatedActivities].length ? <div className="member-post-list">{[...relations.organizedActivities, ...relations.participatedActivities].slice(0, 12).map((activity) => <article key={`${activity.id}-${activity.status}`}><small>{activity.status} · {activity.startsAt.toLocaleDateString('zh-CN')}</small><p><Link href={`/activities/${activity.id}`}>{activity.title}</Link></p></article>)}</div> : null}</section><section className="member-posts" aria-labelledby="member-public-posts"><div className="account-section-head"><h2 id="member-public-posts">公开动态</h2><span>第 {page} 页</span></div>{posts.length > 0 ? <div className="member-post-list">{posts.map((post) => <article key={post.id}><small>{post.city}</small><p><Link href={`/posts/${post.id}`}>{post.body}</Link></p><footer><span>回复 {post.replies}</span><Link href={`/posts/${post.id}`}>查看详情 →</Link></footer></article>)}</div> : <p className="empty-state">这位成员暂时没有公开动态。</p>}<nav className="directory-pagination" aria-label="成员动态分页">{page > 1 ? <Link href={`/members/${userId}?page=${page - 1}`}>← 上一页</Link> : null}{member.posts.length > limit ? <Link href={`/members/${userId}?page=${page + 1}`}>下一页 →</Link> : null}</nav></section></>}
  </section></main>;
}
