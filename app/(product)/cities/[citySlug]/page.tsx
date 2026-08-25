import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CityMembershipControl, PostComposer } from '@/features/product-controls';
import { createPageMetadata } from '@/lib/seo';
import { readSession } from '@/server/auth/session';
import { listCityMembers } from '@/server/repositories/community';
import { listPublicOrganizations } from '@/server/repositories/organizations';
import { listPublicPolicies } from '@/server/repositories/policies';
import { getPublicCity, isCityMember, listCityPosts, listPublicActivities } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ citySlug: string }> }): Promise<Metadata> {
  const city = await getPublicCity((await params).citySlug);
  return city ? createPageMetadata({ title: `${city.name} OPC 社区｜游民`, description: `加入${city.name}的一人公司创业者社区。`, canonical: `/cities/${city.slug}`, useBrandImage: false }) : {};
}

const tabs = ['posts', 'activities', 'organizations', 'members', 'policies'] as const;
type Tab = typeof tabs[number];

export default async function CityPage({ params, searchParams }: { params: Promise<{ citySlug: string }>; searchParams: Promise<{ tab?: string; page?: string; q?: string; topic?: string }> }) {
  const city = await getPublicCity((await params).citySlug);
  if (!city) notFound();
  const filters = await searchParams;
  const tab: Tab = tabs.includes(filters.tab as Tab) ? filters.tab as Tab : 'posts';
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = 20;
  const session = await readSession();
  const joined = session ? await isCityMember(session.id, city.id) : false;
  const [cityPosts, activities, organizations, members, policies] = await Promise.all([
    tab === 'posts' ? listCityPosts(city.id, city.name, session?.id, { topic: filters.topic, limit: limit + 1, offset: (page - 1) * limit }) : [],
    tab === 'activities' ? listPublicActivities(city.id) : [],
    tab === 'organizations' ? listPublicOrganizations({ cityId: city.id, viewerId: session?.id, query: filters.q, limit: limit + 1, offset: (page - 1) * limit }) : [],
    tab === 'members' ? listCityMembers(city.id, { query: filters.q, limit: limit + 1, offset: (page - 1) * limit }) : [],
    tab === 'policies' ? listPublicPolicies(city.id) : [],
  ]);
  const items = tab === 'posts' ? cityPosts : tab === 'activities' ? activities : tab === 'organizations' ? organizations : tab === 'members' ? members : policies;
  const hasNext = items.length > limit;
  const color = ['violet', 'lime', 'peach', 'blue', 'yellow', 'rose'][[...city.slug].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 6];
  const tabHref = (target: Tab) => `/cities/${city.slug}${target === 'posts' ? '' : `?tab=${target}`}`;
  const pageHref = (target: number) => `/cities/${city.slug}?tab=${tab}&page=${target}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ''}${filters.topic ? `&topic=${encodeURIComponent(filters.topic)}` : ''}`;
  return <main className="community-page route-community-page">
    <section className={`city-banner ${color}`}><div className="city-banner-copy"><h1>{city.name}</h1><p>{city.memberCount.toLocaleString('zh-CN')} 位成员正在分享真实经营经验与城市连接。</p></div></section>
    <div className="community-layout"><section className="feed-column"><div className="feed-toolbar"><div className="filter-tabs" aria-label="城市社区内容">{([['posts', '动态'], ['activities', '活动'], ['organizations', '机构'], ['members', '成员'], ['policies', '政策']] as const).map(([key, label]) => <Link className={tab === key ? 'active' : ''} href={tabHref(key)} key={key}>{label}</Link>)}</div>{tab === 'posts' ? session ? joined ? <a className="publish-button route-publish-link" href="#publish">＋ 发布动态</a> : <a className="publish-button route-publish-link" href="#city-membership">加入后发布</a> : <Link className="publish-button route-publish-link" href="/login">登录后发布</Link> : null}</div>
      {['members', 'organizations'].includes(tab) ? <form className="catalog-search" action={`/cities/${city.slug}`}><input type="hidden" name="tab" value={tab} /><label htmlFor="city-directory-search">搜索{tab === 'members' ? '成员' : '机构'}</label><div><input id="city-directory-search" name="q" defaultValue={filters.q} /><button>搜索</button></div></form> : null}
      {tab === 'posts' && session && joined ? <div id="publish"><PostComposer cityId={city.id} /></div> : null}
      {tab === 'posts' ? <div className="feed-list">{cityPosts.slice(0, limit).map((post) => <article className="feed-item" key={post.id}><div className="feed-content"><Link className="author-row author-link" href={`/members/${post.authorId}`}><span className="avatar avatar-initial" aria-hidden="true">{post.author.slice(0, 1)}</span><span><strong>{post.author}</strong><small>{post.city} · {post.publishedAt?.toLocaleString('zh-CN') ?? '社区动态'}</small></span></Link><Link href={`/posts/${post.id}`}><p className="feed-copy">{post.body}</p></Link>{post.topics?.length ? <div className="profile-tags">{post.topics.map((topic) => <Link href={`/cities/${city.slug}?topic=${encodeURIComponent(topic)}`} key={topic}>#{topic}</Link>)}</div> : null}<div className="feed-actions route-feed-stats"><Link href={`/posts/${post.id}`}>喜欢 <b>{post.reactions ?? 0}</b></Link><Link href={`/posts/${post.id}`}>回复 <b>{post.replies}</b></Link><Link href={`/posts/${post.id}`}>收藏 <b>{post.saves ?? 0}</b></Link></div></div></article>)}</div> : null}
      {tab === 'activities' ? <div className="my-activity-list">{activities.slice(0, limit).map((activity) => <article className="my-activity-card route-activity-card" key={activity.id}><div className="activity-card-index">{activity.date.slice(5).replace('-', '.')}</div><div><small>{activity.location}</small><h3>{activity.title}</h3><p>{activity.summary}</p><Link className="directory-link" href={`/activities/${activity.id}`}>查看活动 →</Link></div></article>)}</div> : null}
      {tab === 'organizations' ? <div className="organization-directory">{organizations.slice(0, limit).map((organization) => <article className="organization-list-card" key={organization.id}><div className="organization-list-body"><small>{organization.category}</small><h3>{organization.name}</h3><p>{organization.summary}</p><Link className="directory-link" href={`/organizations/${organization.id}`}>查看机构 →</Link></div></article>)}</div> : null}
      {tab === 'members' ? <div className="member-post-list">{members.slice(0, limit).map((member) => <article key={member.id}><small>{member.role} · {member.postCount} 条城市动态 · {member.followerCount} 位关注者</small><h3><Link href={`/members/${member.id}`}>{member.name}</Link></h3><p>{member.bio || member.occupationTags.join(' · ')}</p></article>)}</div> : null}
      {tab === 'policies' ? <div className="content-list">{policies.slice(0, limit).map((policy) => <article key={policy.id}><small>{policy.category} · {policy.issuingAuthority}</small><h3><Link href={`/policies/${policy.id}`}>{policy.title}</Link></h3><p>{policy.summary}</p></article>)}</div> : null}
      {items.length === 0 ? <p className="empty-state">当前分区暂无公开内容。</p> : null}<nav className="directory-pagination" aria-label="城市内容分页">{page > 1 ? <Link href={pageHref(page - 1)}>← 上一页</Link> : null}{hasNext ? <Link href={pageHref(page + 1)}>下一页 →</Link> : null}</nav>
    </section><aside className="city-data"><div className="data-header"><h2>城市数据</h2><span>REGION {city.regionCode}</span></div><div id="city-membership">{session ? <CityMembershipControl cityId={city.id} initialJoined={joined} /> : <Link className="wide-join route-wide-link" href="/login">登录并加入城市</Link>}</div><div className="metric-grid"><div><small>社区成员</small><strong>{city.memberCount.toLocaleString('zh-CN')}</strong></div><div><small>近期活动</small><strong>{city.activityCount}</strong></div><div><small>城市状态</small><strong>开放</strong></div><div><small>内容状态</small><strong>实时</strong></div></div><section className="data-card route-city-card"><h3>城市社区</h3><p>加入后可发布动态、参与讨论、报名活动并关注本地成员。</p><Link href={tabHref('members')}>查看城市成员 →</Link></section></aside></div>
  </main>;
}
