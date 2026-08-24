/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlockControl, FollowControl, ReportControl } from '@/features/product-controls';
import { readSession } from '@/server/auth/session';
import { getPublicMember, isBlocked, isFollowing } from '@/server/repositories/public-content';

export default async function MemberPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const member = await getPublicMember(userId);
  if (!member) notFound();
  const session = await readSession();
  const [following, blocked] = session && session.id !== userId ? await Promise.all([isFollowing(session.id, userId), isBlocked(session.id, userId)]) : [false, false];
  return <main className="account-page"><section className="account-content"><Link className="account-back" href="/cities">← 返回社区</Link><div className="member-card route-member-card">{member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name}的头像`} /> : <div className="member-route-avatar" aria-hidden="true">{member.name.slice(0, 1)}</div>}<div className="member-card-copy"><small>OPC 社区成员</small><h1>{member.name}</h1><p>{member.bio || member.occupationTags.join(' · ')}</p><div className="profile-tags">{member.occupationTags.map((tag) => <i key={tag}>{tag}</i>)}</div></div><dl><div><dt>{member.posts.length}</dt><dd>动态</dd></div><div><dt>开放</dt><dd>主页</dd></div></dl><div className="member-follow-zone">{session ? session.id !== userId && <div className="member-action-stack">{!blocked && <FollowControl memberId={userId} initialFollowing={following} />}<BlockControl memberId={userId} initialBlocked={blocked} /><ReportControl targetType="user" targetId={userId} /></div> : <Link href="/login">登录后关注</Link>}</div></div><section className="member-posts" aria-labelledby="member-public-posts"><div className="account-section-head"><h2 id="member-public-posts">公开动态</h2><span>全部 {member.posts.length} 条</span></div>{member.posts.length > 0 ? <div className="member-post-list">{member.posts.map((post) => <article key={post.id}><small>{post.city}</small><p><Link href={`/posts/${post.id}`}>{post.body}</Link></p><footer><span>回复 {post.replies}</span><Link href={`/posts/${post.id}`}>查看详情 →</Link></footer></article>)}</div> : <p className="empty-state">这位成员暂时没有公开动态。</p>}</section></section></main>;
}
