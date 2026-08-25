import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActivityRegistrationControl, ReportControl } from '@/features/product-controls';
import { AttendanceControls } from '@/features/activities/attendance-controls';
import { createPageMetadata } from '@/lib/seo';
import { readSession } from '@/server/auth/session';
import { getPublicActivity, isRegisteredForActivity, listActivityParticipants } from '@/server/repositories/public-content';

export async function generateMetadata({ params }: { params: Promise<{ activityId: string }> }): Promise<Metadata> {
  const { activityId } = await params;
  const activity = await getPublicActivity(activityId);
  return activity ? createPageMetadata({ title: `${activity.title}｜游民活动`, description: activity.summary, canonical: `/activities/${activity.id}`, useBrandImage: false }) : {};
}

export default async function ActivityPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const activity = await getPublicActivity(activityId);
  if (!activity) notFound();
  const session = await readSession();
  const registered = session ? await isRegisteredForActivity(session.id, activityId) : false;
  const startsAt = new Date(activity.startsAt);
  const endsAt = new Date(activity.endsAt);
  const now = new Date();
  const canManageAttendance = Boolean(session && (session.id === activity.organizerId || session.role === 'city_admin' || session.role === 'platform_admin'));
  const participants = canManageAttendance ? await listActivityParticipants(activityId) : [];
  const registrationOpen = activity.status === 'published' && startsAt > now && activity.registered < activity.capacity;
  const statusLabel = activity.status === 'cancelled' ? '已取消' : activity.status === 'ended' || endsAt <= now ? '已结束' : startsAt <= now ? '进行中' : '报名中';
  return <main className="article-page activity-detail-page"><header className="article-hero"><Link href="/activities">← 返回活动</Link><span className="knowledge-tag">{activity.city} · {statusLabel}</span><h1>{activity.title}</h1><p>{activity.summary}</p></header><article className="article-body"><dl className="detail-facts"><div><dt>时间</dt><dd>{startsAt.toLocaleString('zh-CN')} — {endsAt.toLocaleString('zh-CN')}</dd></div><div><dt>地点</dt><dd>{activity.location}</dd></div><div><dt>名额</dt><dd>{activity.registered}/{activity.capacity}</dd></div><div><dt>发起人</dt><dd><Link href={`/members/${activity.organizerId}`}>{activity.organizer}</Link></dd></div><div><dt>费用</dt><dd>免费</dd></div></dl><section><h2>活动详情</h2>{activity.details.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section><div className="activity-registration-panel"><span>{statusLabel}{registrationOpen ? ` · 剩余 ${Math.max(0, activity.capacity - activity.registered)} 个名额` : ''}</span>{session ? registered && startsAt > now && activity.status === 'published' ? <ActivityRegistrationControl activityId={activityId} initialRegistered /> : registrationOpen ? <ActivityRegistrationControl activityId={activityId} initialRegistered={false} /> : <strong>{registered ? '已报名' : '当前不可报名'}</strong> : registrationOpen ? <Link href="/login">登录后报名</Link> : <strong>报名已关闭</strong>}</div>{session && <ReportControl targetType="activity" targetId={activityId} />}{canManageAttendance ? <section className="member-posts"><div className="account-section-head"><h2>参与者与签到</h2><span>{participants.length} 条报名记录</span></div>{participants.length ? <div className="account-records">{participants.map((participant) => <article key={participant.userId}><small>{participant.status} · 报名于 {participant.registeredAt.toLocaleString('zh-CN')}</small><h3><Link href={`/members/${participant.userId}`}>{participant.nickname}</Link></h3>{startsAt <= now && participant.status !== 'cancelled' ? <AttendanceControls activityId={activity.id} userId={participant.userId} currentStatus={participant.status} /> : null}</article>)}</div> : <p className="empty-state">暂无报名记录。</p>}</section> : null}</article></main>;
}
