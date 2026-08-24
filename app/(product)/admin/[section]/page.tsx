import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActivityCreatorEligibilityControl, ActivityReviewControls, AppealReviewControls, ApplicationReviewControls, CityAdminControl, CommentModerationControls, DeadLetterControl, HelpTicketReviewControl, MediaReviewControls, PostModerationControls, ReportReviewControls, UserRoleControl, UserStatusControls } from '@/features/admin/admin-controls';
import { ContentEditor } from '@/features/admin/content-editor';
import { requireSession } from '@/server/auth/session';
import { listManagedCityIds } from '@/server/auth/city-scope';
import { listAdminActivities, listAdminAppeals, listAdminApplications, listAdminAuditLogs, listAdminCities, listAdminComments, listAdminContent, listAdminDeadLetters, listAdminMedia, listAdminPosts, listAdminReports, listAdminUsers } from '@/server/repositories/admin';

const sections: Record<string, { title: string; columns: string[] }> = {
  users: { title: '用户、封禁和角色管理', columns: ['用户', '状态', '角色', '最近登录', '操作'] },
  posts: { title: '动态、评论和举报审核', columns: ['目标内容', '规则结果', '举报', '状态', '操作'] },
  activities: { title: '活动与发起人审核', columns: ['活动', '城市', '发起人', '状态', '操作'] },
  content: { title: '知识和洞察管理', columns: ['内容', '分类', '编辑', '状态', '操作'] },
  cities: { title: '城市信息和管理员', columns: ['城市', '成员', '管理员', '状态', '操作'] },
  applications: { title: 'OPC、机构申请和帮助工单', columns: ['申请人', '类型', '说明', '状态', '操作'] },
  operations: { title: '异步任务与死信处置', columns: ['失败时间', '主题', '错误', '状态', '操作'] },
  audit: { title: '后台操作审计', columns: ['时间', '操作者', '动作', '目标', '请求 ID'] },
};

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const section = (await params).section;
  const item = sections[section];
  if (!item) notFound();
  const session = await requireSession(['editor', 'city_admin', 'platform_admin']);
  const allowed = session.role === 'platform_admin' || (session.role === 'editor' ? section === 'content' : ['posts', 'activities', 'cities'].includes(section));
  if (!allowed) notFound();
  const cityIds = await listManagedCityIds(session);
  let rows: React.ReactNode;
  if (section === 'users') rows = (await listAdminUsers()).map((row) => <div role="row" key={row.id}><span>{row.nickname}<small>{row.id.slice(0, 8)}</small></span><span>{row.status}<ActivityCreatorEligibilityControl userId={row.id} approved={Boolean(row.activityCreatorApprovedAt)} requested={Boolean(row.activityCreatorRequestedAt)} /></span><UserRoleControl userId={row.id} role={row.role} /><span>{row.lastLoginAt?.toLocaleString('zh-CN') ?? '从未'}</span><UserStatusControls userId={row.id} status={row.status} /></div>);
  else if (section === 'posts') {
    const [postRows, commentRows, reportRows, appealRows, mediaRows] = await Promise.all([listAdminPosts(cityIds), listAdminComments(cityIds), listAdminReports(cityIds), listAdminAppeals(cityIds), listAdminMedia(cityIds)]);
    rows = <>{postRows.map((row) => <div role="row" key={row.id}><span><Link href={`/posts/${row.id}`}>{row.content.slice(0, 48)}</Link><small>{row.author}</small></span><span>动态</span><span>{row.reportCount}</span><span>{row.status}</span><PostModerationControls postId={row.id} status={row.status} /></div>)}{commentRows.map((row) => <div role="row" key={row.id}><span><Link href={`/posts/${row.postId}`}>{row.content.slice(0, 48)}</Link><small>{row.author}</small></span><span>评论</span><span>—</span><span>{row.status}</span><CommentModerationControls commentId={row.id} status={row.status} /></div>)}{reportRows.map((row) => <div role="row" key={row.id}><span>{row.targetType}:{row.targetId.slice(0, 8)}<small>{row.reason} {row.details}</small></span><span>举报</span><span>{row.decision ?? '待判断'}</span><span>{row.caseStatus ?? row.status}</span>{row.status === 'open' ? <ReportReviewControls reportId={row.id} /> : <span>已处理</span>}</div>)}{appealRows.map((row) => <div role="row" key={row.id}><span>{row.targetType}:{row.targetId.slice(0, 8)}<small>{row.reason}</small></span><span>申诉</span><span>—</span><span>{row.status}</span>{['approved', 'rejected'].includes(row.status) ? <span>已处理</span> : <AppealReviewControls appealId={row.id} />}</div>)}{mediaRows.map((row) => <div role="row" key={row.id}><span><a href={row.previewUrl} target="_blank" rel="noreferrer">预览 {row.kind}</a><small>{(row.byteSize / 1024 / 1024).toFixed(1)} MB</small></span><span>媒体</span><span>—</span><span>{row.status}</span><MediaReviewControls mediaId={row.id} status={row.status} /></div>)}</>;
  }
  else if (section === 'activities') rows = (await listAdminActivities(cityIds)).map((row) => <div role="row" key={row.id}><span><Link href={`/activities/${row.id}`}>{row.title}</Link></span><span>{row.city}</span><span>{row.organizer}</span><span>{row.status}</span><ActivityReviewControls activityId={row.id} status={row.status} /></div>);
  else if (section === 'content') rows = (await listAdminContent()).map((row) => <div role="row" key={`${row.kind}-${row.id}`}><span>{row.title}</span><span>{row.category}</span><span>{row.kind === 'knowledge' ? '知识' : '洞察'}</span><span>{row.status}</span><ContentEditor value={row} /></div>);
  else if (section === 'cities') rows = (await listAdminCities(cityIds)).map((row) => <div role="row" key={row.id}><span>{row.name}<small>{row.regionCode}</small></span><span>{row.memberCount}</span><span>{row.managers || '未分配'}</span><span>开放</span><span>{session.role === 'platform_admin' ? <CityAdminControl cityId={row.id} /> : '—'}</span></div>);
  else if (section === 'applications') rows = (await listAdminApplications()).map((row) => <div role="row" key={`${row.kind}-${row.id}`}><span>{row.title}<small>{row.contact || row.createdAt.toLocaleString('zh-CN')}</small></span><span>{row.kind === 'opc' ? 'OPC 认证' : row.kind === 'organization' ? '机构申请' : '帮助工单'}</span><span>{row.subtitle}<small>{row.detail || '未填写补充说明'}</small></span><span>{row.status}</span><span>{row.kind === 'ticket' ? <HelpTicketReviewControl ticketId={row.id} status={row.status} /> : <ApplicationReviewControls kind={row.kind} applicationId={row.id} status={row.status} />}</span></div>);
  else if (section === 'operations') rows = (await listAdminDeadLetters()).map((row) => <div role="row" key={row.id}><span>{row.failedAt.toLocaleString('zh-CN')}</span><span>{row.topic}</span><span>{row.error.slice(0, 120)}<small>{row.resolutionNotes}</small></span><span>{row.status}</span><DeadLetterControl deadLetterId={row.id} status={row.status} /></div>);
  else rows = (await listAdminAuditLogs()).map((row) => <div role="row" key={row.id}><span>{row.createdAt.toLocaleString('zh-CN')}</span><span>{row.actorId?.slice(0, 8) ?? '系统'}</span><span>{row.action}</span><span>{row.targetType}:{row.targetId?.slice(0, 8)}</span><span>{row.requestId?.slice(0, 8) ?? '—'}</span></div>);
  return <main className="reading-page admin-page"><Link className="back-link" href="/admin">← 返回运营后台</Link><section className="admin-panel"><small>ADMIN MODULE</small><h1>{item.title}</h1>{section === 'content' && <ContentEditor />}<div className="admin-table" role="table"><div role="row">{item.columns.map((column) => <strong role="columnheader" key={column}>{column}</strong>)}</div>{rows}</div></section></main>;
}
