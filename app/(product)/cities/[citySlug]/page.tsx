import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CityMembershipControl, PostComposer } from '@/features/product-controls';
import { readSession } from '@/server/auth/session';
import { getPublicCity, isCityMember, listCityPosts } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }): Promise<Metadata> {
  const city = await getPublicCity((await params).citySlug);
  return city ? { title: `${city.name} OPC 社区｜游民`, description: `加入${city.name}的一人公司创业者社区。` } : {};
}

export default async function CityPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const city = await getPublicCity((await params).citySlug);
  if (!city) notFound();
  const session = await readSession();
  const [cityPosts, joined] = await Promise.all([listCityPosts(city.id, city.name, session?.id), session ? isCityMember(session.id, city.id) : false]);
  const color = ['violet', 'lime', 'peach', 'blue', 'yellow', 'rose'][[...city.slug].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 6];
  return (
    <main className="community-page route-community-page">
      <section className={`city-banner ${color}`}><div className="city-banner-copy"><h1>{city.name}</h1><p>{city.memberCount.toLocaleString('zh-CN')} 位成员正在分享真实经营经验与城市连接。</p></div></section>
      <div className="community-layout">
        <section className="feed-column"><div className="feed-toolbar"><div className="filter-tabs" role="tablist" aria-label="城市社区内容"><Link className="active" href={`/cities/${city.slug}`} role="tab" aria-selected="true">动态</Link><Link href="/activities" role="tab">活动</Link><Link href={`/cities/${city.slug}#members`} role="tab">成员</Link></div>{session ? joined ? <a className="publish-button route-publish-link" href="#publish">＋ 发布动态</a> : <a className="publish-button route-publish-link" href="#city-membership">加入后发布</a> : <Link className="publish-button route-publish-link" href="/login">登录后发布</Link>}</div>
          {session && joined && <div id="publish"><PostComposer cityId={city.id} /></div>}
          <div className="feed-list">{cityPosts.map((post) => <article className="feed-item" key={post.id}><div className="feed-content"><Link className="author-row author-link" href={`/members/${post.authorId}`}><span className="avatar avatar-initial" aria-hidden="true">{post.author.slice(0, 1)}</span><span><strong>{post.author}</strong><small>{post.city} · 社区动态</small></span></Link><Link href={`/posts/${post.id}`}><p className="feed-copy">{post.body}</p></Link><div className="feed-actions route-feed-stats"><Link href={`/posts/${post.id}`}>喜欢 <b>{post.reactions ?? 0}</b></Link><Link href={`/posts/${post.id}`}>回复 <b>{post.replies}</b></Link><Link href={`/posts/${post.id}`}>收藏 <b>{post.saves ?? 0}</b></Link></div></div></article>)}</div>
          {cityPosts.length === 0 && <p className="empty-state">这座城市还没有公开动态，成为第一位分享者。</p>}
        </section>
        <aside className="city-data"><div className="data-header"><h2>城市数据</h2><span>REGION {city.regionCode}</span></div><div id="city-membership">{session ? <CityMembershipControl cityId={city.id} initialJoined={joined} /> : <Link className="wide-join route-wide-link" href="/login">登录并加入城市</Link>}</div><div className="metric-grid"><div><small>社区成员</small><strong>{city.memberCount.toLocaleString('zh-CN')}</strong></div><div><small>近期活动</small><strong>{city.activityCount}</strong></div><div><small>城市状态</small><strong>开放</strong></div><div><small>内容状态</small><strong>实时</strong></div></div><section className="data-card route-city-card" id="members"><h3>城市社区</h3><p>加入后可发布动态、参与讨论、报名活动并关注本地成员。</p><Link href="/activities">查看城市活动 →</Link></section></aside>
      </div>
    </main>
  );
}
