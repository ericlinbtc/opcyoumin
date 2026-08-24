import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActivityRegistrationControl, ReportControl } from '@/features/product-controls';
import { readSession } from '@/server/auth/session';
import { getPublicActivity, isRegisteredForActivity } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ activityId: string }> }): Promise<Metadata> {
  const { activityId } = await params;
  const activity = await getPublicActivity(activityId);
  return activity ? { title: `${activity.title}｜游民活动`, description: activity.summary } : {};
}

export default async function ActivityPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const activity = await getPublicActivity(activityId);
  if (!activity) notFound();
  const session = await readSession();
  const registered = session ? await isRegisteredForActivity(session.id, activityId) : false;
  return <main className="article-page activity-detail-page"><header className="article-hero"><Link href="/activities">← 返回活动</Link><span className="knowledge-tag">{activity.city} · {activity.date}</span><h1>{activity.title}</h1><p>{activity.summary}</p></header><article className="article-body"><dl className="detail-facts"><div><dt>地点</dt><dd>{activity.location}</dd></div><div><dt>名额</dt><dd>{activity.registered}/{activity.capacity}</dd></div><div><dt>费用</dt><dd>免费</dd></div></dl><div className="activity-registration-panel"><span>剩余 {Math.max(0, activity.capacity - activity.registered)} 个名额</span>{session ? <ActivityRegistrationControl activityId={activityId} initialRegistered={registered} /> : <Link href="/login">登录后报名</Link>}</div>{session && <ReportControl targetType="activity" targetId={activityId} />}</article></main>;
}
