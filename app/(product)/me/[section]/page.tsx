import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CleanInactiveSessionsButton, HelpTicketControl, MarkNotificationReadButton, MarkNotificationsReadButton, RevokeSessionButton } from '@/features/account/account-controls';
import { AppealControl, AppealSupplementControl, PostOwnerControls } from '@/features/product-controls';
import { ActivityOwnerControls } from '@/features/activities/activity-owner-controls';
import { requireSession } from '@/server/auth/session';
import { listAccountActivities, listAccountAppeals, listAccountApplications, listAccountCityMemberships, listAccountFollows, listAccountHelpTickets, listAccountNotifications, listAccountOrganizationMemberships, listAccountPosts, listAccountSaves, listAccountSessions, listOrganizedActivities } from '@/server/repositories/account';

const sections: Record<string, { title: string; description: string }> = {
  posts: { title: '我的动态', description: '管理已发布、待审核、隐藏和软删除的动态。' },
  saves: { title: '我的收藏', description: '查看与整理收藏的社区内容。' },
  follows: { title: '我的关注', description: '管理关注的成员与城市。' },
  activities: { title: '我的活动', description: '查看已报名、已取消和已参加的活动记录。' },
  applications: { title: '我的申请', description: '跟踪机构申请和帮助工单的处理进度。' },
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
    const [rows, joinedCities] = await Promise.all([listAccountFollows(session.id), listAccountCityMemberships(session.id)]);
    content = <>{joinedCities.length > 0 && <><h2>已加入城市</h2><div className="account-records">{joinedCities.map((row) => <article key={row.id}><small>{row.role} · 加入于 {row.joinedAt.toLocaleString('zh-CN')}</small><h2><Link href={`/cities/${row.slug}`}>{row.name}</Link></h2></article>)}</div></>}{rows.length > 0 && <><h2>已关注成员</h2><div className="account-records">{rows.map((row) => <article key={row.id}><small>关注于 {row.followedAt.toLocaleString('zh-CN')}</small><h2><Link href={`/members/${row.id}`}>{row.nickname}</Link></h2><p>{row.bio}</p></article>)}</div></>}{rows.length === 0 && joinedCities.length === 0 && <Empty />}</>;
  } else if (section === 'activities') {
    const [rows, organized] = await Promise.all([listAccountActivities(session.id), listOrganizedActivities(session.id)]);
    content = <>{organized.length > 0 && <><h2>我发起的活动</h2><div className="account-records">{organized.map((row) => <article key={row.id}><small>{row.city} · {row.status}</small><h2>{row.title}</h2><time>{row.startsAt.toLocaleString('zh-CN')}</time><ActivityOwnerControls activity={row} />{row.status === 'cancelled' && <AppealControl targetType="activity" targetId={row.id} />}</article>)}</div></>}{rows.length > 0 && <><h2>我报名的活动</h2><div className="account-records">{rows.map((row) => <article key={row.id}><small>{row.city} · {row.status}</small><h2><Link href={`/activities/${row.id}`}>{row.title}</Link></h2><time>{row.startsAt.toLocaleString('zh-CN')}</time></article>)}</div></>}{rows.length === 0 && organized.length === 0 && <Empty />}</>;
  } else if (section === 'applications') {
    const [rows, tickets, memberships] = await Promise.all([listAccountApplications(session.id), listAccountHelpTickets(session.id), listAccountOrganizationMemberships(session.id)]);
    content = <>{memberships.length > 0 && <><h2>已加入机构</h2><div className="account-records">{memberships.map((row) => <article key={row.id}><small>{row.role} · 加入于 {row.joinedAt.toLocaleString('zh-CN')}</small><h2><Link href={`/organizations/${row.id}`}>{row.name}</Link></h2></article>)}</div></>}{rows.length > 0 && <><h2>机构申请</h2><div className="account-records">{rows.map((row) => <article key={`${row.kind}-${row.id}`}><small>{row.kind} · {row.createdAt.toLocaleString('zh-CN')}</small><h2>{row.title}</h2><p>当前状态：{row.status}{row.reviewNotes ? ` · 审核说明：${row.reviewNotes}` : ''}</p></article>)}</div></>}{tickets.length > 0 && <><h2 id="help-tickets">帮助工单</h2><div className="account-records">{tickets.map((ticket) => <article id={`ticket-${ticket.id}`} key={ticket.id}><small>{ticket.status} · 更新于 {ticket.updatedAt.toLocaleString('zh-CN')}</small><h2>{ticket.description.slice(0, 80)}</h2>{ticket.messages.map((message) => <div className="ticket-message" key={message.id}><small>{message.authorRole === 'requester' ? '我' : '社区支持'} · {message.createdAt.toLocaleString('zh-CN')}</small><p>{message.body}</p></div>)}{ticket.resolution ? <p><strong>处理结果：</strong>{ticket.resolution}</p> : null}<HelpTicketControl ticketId={ticket.id} canReply={ticket.status !== 'closed'} canClose={ticket.status === 'resolved'} /></article>)}</div></>}{rows.length === 0 && tickets.length === 0 && memberships.length === 0 && <Empty />}</>;
  } else if (section === 'notifications') {
    const rows = await listAccountNotifications(session.id);
    content = <>{rows.some((row) => !row.readAt) && <MarkNotificationsReadButton />}{rows.length ? <div className="account-records">{rows.map((row) => { const href = notificationHref(row.payload); return <article className={row.readAt ? '' : 'unread'} key={row.id}><small>{row.type} · {row.createdAt.toLocaleString('zh-CN')}</small><h2>{href ? <Link href={href}>{row.title}</Link> : row.title}</h2><p>{row.body}</p>{!row.readAt ? <MarkNotificationReadButton notificationId={row.id} /> : null}</article>; })}</div> : <Empty />}</>;
  } else if (section === 'sessions') {
    const rows = await listAccountSessions(session.id);
    content = <><p className="empty-state">如发现陌生设备，请立即撤销该会话，并通过帮助中心联系平台。</p><CleanInactiveSessionsButton />{rows.length ? <div className="account-records">{rows.map((row) => { const inactive = Boolean(row.revokedAt || row.expiresAt <= new Date()); return <article key={row.id}><small>{row.id === session.sessionId ? '当前会话' : row.revokedAt ? '已撤销' : row.expiresAt <= new Date() ? '已过期' : '活跃会话'}</small><h2>{deviceLabel(row.userAgent)}</h2><p>{row.userAgent ?? '未提供设备信息'}</p><p>创建于 {row.createdAt.toLocaleString('zh-CN')} · 到期 {row.expiresAt.toLocaleString('zh-CN')}</p>{!inactive && <RevokeSessionButton sessionId={row.id} current={row.id === session.sessionId} />}</article>; })}</div> : <Empty />}</>;
  } else {
    const rows = await listAccountAppeals(session.id);
    content = rows.length ? <div className="account-records">{rows.map((row) => <article key={row.id}><small>{row.targetType}:{row.targetId.slice(0, 8)} · {row.status} · 提交于 {row.createdAt.toLocaleString('zh-CN')}</small><h2>{row.reason}</h2><p>{row.decision ? `处理结果：${row.decision} ${row.notes ?? ''}` : '等待管理员处理'}</p>{['open', 'reviewing'].includes(row.status) ? <AppealSupplementControl appealId={row.id} /> : row.status === 'rejected' ? <AppealControl targetType={row.targetType as 'post' | 'comment' | 'activity'} targetId={row.targetId} /> : null}</article>)}</div> : <Empty />;
  }
  return <main className="account-page"><section className="account-hero"><div className="account-hero-inner"><div className="account-hero-copy"><p className="eyebrow">个人中心 · ACCOUNT</p><h1>{item.title}</h1><p>{item.description}</p></div></div></section><section className="account-content"><Link className="account-back" href="/me">← 返回个人主页</Link>{content}</section></main>;
}

function Empty() {
  return <div className="empty-state">当前暂无记录。</div>;
}

function notificationHref(payload: Record<string, unknown>): string | null {
  if (typeof payload.postId === 'string') return `/posts/${payload.postId}`;
  if (typeof payload.activityId === 'string') return `/activities/${payload.activityId}`;
  if (typeof payload.organizationId === 'string') return `/organizations/${payload.organizationId}`;
  if (typeof payload.actorId === 'string') return `/members/${payload.actorId}`;
  if (typeof payload.ticketId === 'string') return `/me/applications#ticket-${payload.ticketId}`;
  if (typeof payload.applicationId === 'string') return '/me/applications';
  if (typeof payload.appealId === 'string') return '/me/appeals';
  if (typeof payload.sessionId === 'string') return '/me/sessions';
  return null;
}

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return '未知设备';
  const browser = userAgent.includes('Edg/') ? 'Edge' : userAgent.includes('Chrome/') ? 'Chrome' : userAgent.includes('Safari/') ? 'Safari' : userAgent.includes('Firefox/') ? 'Firefox' : '浏览器';
  const system = userAgent.includes('iPhone') ? 'iPhone' : userAgent.includes('Android') ? 'Android' : userAgent.includes('Mac OS') ? 'macOS' : userAgent.includes('Windows') ? 'Windows' : '未知系统';
  return `${browser} · ${system}`;
}
