import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarkNotificationsReadButton, RevokeSessionButton } from '@/features/account/account-controls';
import { AppealControl, PostOwnerControls } from '@/features/product-controls';
import { ActivityOwnerControls } from '@/features/activities/activity-owner-controls';
import { requireSession } from '@/server/auth/session';
import { listAccountActivities, listAccountAppeals, listAccountApplications, listAccountFollows, listAccountNotifications, listAccountPosts, listAccountSaves, listAccountSessions, listOrganizedActivities } from '@/server/repositories/account';

const sections: Record<string, { title: string; description: string }> = {
  posts: { title: '我的动态', description: '管理已发布、待审核、隐藏和软删除的动态。' },
  saves: { title: '我的收藏', description: '查看与整理收藏的社区内容。' },
  follows: { title: '我的关注', description: '管理关注的成员与城市。' },
  activities: { title: '我的活动', description: '查看已报名、已取消和已参加的活动记录。' },
  applications: { title: '我的申请', description: '跟踪 OPC 认证和机构申请的审核进度。' },
  notifications: { title: '通知中心', description: '评论、回复、关注、活动与账号安全通知。' },
  sessions: { title: '会话管理', description: '查看活跃登录并撤销不再使用的会话。' },
  appeals: { title: '我的申诉', description: '跟踪内容或活动审核申诉的处理状态。' },
};

export default async function MeSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const section = (await params).section;
  const item = sections[section];
  if (!item) notFound();
  const session = await requireSession();
  let content;
  if (section === 'posts') {
    const rows = await listAccountPosts(session.id);
    content = rows.length ? <div className="account-records">{rows.map((row) => <article key={row.id}><small>{row.status} · {row.createdAt.toLocaleString('zh-CN')}</small><h2>{row.status === 'published' ? <Link href={`/posts/${row.id}`}>{row.content.slice(0, 80)}</Link> : row.content.slice(0, 80)}</h2><p>{row.reactions} 点赞 · {row.comments} 评论</p>{row.status !== 'deleted' && <PostOwnerControls postId={row.id} content={row.content} />}{['hidden', 'deleted'].includes(row.status) && <AppealControl targetType="post" targetId={row.id} />}</article>)}</div> : <Empty />;
  } else if (section === 'saves') {
    const rows = await listAccountSaves(session.id);
    content = rows.length ? <div className="account-records">{rows.map((row) => <article key={row.id}><small>{row.city ?? '全国'} · 收藏于 {row.savedAt.toLocaleString('zh-CN')}</small><h2><Link href={`/posts/${row.id}`}>{row.content.slice(0, 80)}</Link></h2></article>)}</div> : <Empty />;
  } else if (section === 'follows') {
    const rows = await listAccountFollows(session.id);
    content = rows.length ? <div className="account-records">{rows.map((row) => <article key={row.id}><small>关注于 {row.followedAt.toLocaleString('zh-CN')}</small><h2><Link href={`/members/${row.id}`}>{row.nickname}</Link></h2><p>{row.bio}</p></article>)}</div> : <Empty />;
  } else if (section === 'activities') {
    const [rows, organized] = await Promise.all([listAccountActivities(session.id), listOrganizedActivities(session.id)]);
    content = <>{organized.length > 0 && <><h2>我发起的活动</h2><div className="account-records">{organized.map((row) => <article key={row.id}><small>{row.city} · {row.status}</small><h2>{row.title}</h2><time>{row.startsAt.toLocaleString('zh-CN')}</time><ActivityOwnerControls activity={row} />{row.status === 'cancelled' && <AppealControl targetType="activity" targetId={row.id} />}</article>)}</div></>}{rows.length > 0 && <><h2>我报名的活动</h2><div className="account-records">{rows.map((row) => <article key={row.id}><small>{row.city} · {row.status}</small><h2><Link href={`/activities/${row.id}`}>{row.title}</Link></h2><time>{row.startsAt.toLocaleString('zh-CN')}</time></article>)}</div></>}{rows.length === 0 && organized.length === 0 && <Empty />}</>;
  } else if (section === 'applications') {
    const rows = await listAccountApplications(session.id);
    content = rows.length ? <div className="account-records">{rows.map((row) => <article key={`${row.kind}-${row.id}`}><small>{row.kind} · {row.createdAt.toLocaleString('zh-CN')}</small><h2>{row.title}</h2><p>当前状态：{row.status}{row.reviewNotes ? ` · 审核说明：${row.reviewNotes}` : ''}</p></article>)}</div> : <Empty />;
  } else if (section === 'notifications') {
    const rows = await listAccountNotifications(session.id);
    content = <>{rows.some((row) => !row.readAt) && <MarkNotificationsReadButton />}{rows.length ? <div className="account-records">{rows.map((row) => <article className={row.readAt ? '' : 'unread'} key={row.id}><small>{row.type} · {row.createdAt.toLocaleString('zh-CN')}</small><h2>{row.title}</h2><p>{row.body}</p></article>)}</div> : <Empty />}</>;
  } else if (section === 'sessions') {
    const rows = await listAccountSessions(session.id);
    content = rows.length ? <div className="account-records">{rows.map((row) => <article key={row.id}><small>{row.id === session.sessionId ? '当前会话' : row.revokedAt ? '已撤销' : '活跃会话'}</small><h2>{row.userAgent ?? '未知设备'}</h2><p>创建于 {row.createdAt.toLocaleString('zh-CN')} · 到期 {row.expiresAt.toLocaleString('zh-CN')}</p>{!row.revokedAt && <RevokeSessionButton sessionId={row.id} current={row.id === session.sessionId} />}</article>)}</div> : <Empty />;
  } else {
    const rows = await listAccountAppeals(session.id);
    content = rows.length ? <div className="account-records">{rows.map((row) => <article key={row.id}><small>{row.targetType}:{row.targetId.slice(0, 8)} · {row.status}</small><h2>{row.reason}</h2><p>{row.decision ? `处理结果：${row.decision} ${row.notes ?? ''}` : '等待管理员处理'}</p></article>)}</div> : <Empty />;
  }
  return <main className="account-page"><section className="account-hero"><div className="account-hero-inner"><div className="account-hero-copy"><p className="eyebrow">个人中心 · ACCOUNT</p><h1>{item.title}</h1><p>{item.description}</p></div></div></section><section className="account-content"><Link className="account-back" href="/me">← 返回个人主页</Link>{content}</section></main>;
}

function Empty() {
  return <div className="empty-state">当前暂无记录。</div>;
}
