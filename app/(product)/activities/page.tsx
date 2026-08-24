import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/product-shell';
import { ActivityCreator, ActivityCreatorApplication } from '@/features/activities/activity-editor';
import { readSession } from '@/server/auth/session';
import { listPublicActivities, listPublicCities } from '@/server/repositories/public-content';
import { getActivityCreatorCapability } from '@/server/repositories/account';

export const metadata: Metadata = { title: '城市活动｜游民', description: '发现 OPC 城市活动并报名参与。' };
export const dynamic = 'force-dynamic';

export default async function ActivitiesPage() {
  const activityItems = await listPublicActivities();
  const session = await readSession();
  const capability = session ? await getActivityCreatorCapability(session.id) : null;
  const canCreate = Boolean(capability?.canCreate);
  const cities = canCreate ? session?.role === 'user' ? capability!.joinedCities : session?.role === 'city_admin' ? capability!.joinedCities.filter((city) => city.membershipRole === 'city_admin') : await listPublicCities() : [];
  return <main className="feature-page activity-center"><PageHero eyebrow="CITY ACTIVITIES" title="在线认识，线下连接" description="小规模、高质量、可追踪的城市活动。首发版本不包含在线支付。" count={String(activityItems.length)} unit="场开放活动" tone="activity-hero" /><section className="feature-page-body">{canCreate && <ActivityCreator cities={cities.map(({ id, name }) => ({ id, name }))} />}{session?.role === 'user' && !canCreate && <ActivityCreatorApplication requested={Boolean(capability?.requestedAt)} />}<div className="my-activity-list">{activityItems.map((activity) => <article className="my-activity-card route-activity-card" key={activity.id}><div className="activity-card-index" aria-hidden="true">{activity.date.slice(5).replace('-', '.')}</div><div><small>{activity.city} · {activity.location}</small><h3>{activity.title}</h3><p>{activity.summary}</p><div className="activity-status"><b>{activity.registered}/{activity.capacity} 人已报名</b><span>{activity.date}</span></div><Link className="directory-link" href={`/activities/${activity.id}`}>查看活动 →</Link></div></article>)}</div>{activityItems.length === 0 && <p className="empty-state">暂无已发布活动。</p>}</section></main>;
}
