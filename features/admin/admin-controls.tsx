'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';
import { closeReport, completeAccountDeletion, moderateComment, moderatePost, resolveDeadLetter, resolveHelpTicket, reviewActivity, reviewAppeal, reviewApplication, reviewMedia, setActivityCreatorEligibility, setCityAdmin, setUserRole, setUserStatus, startHelpTicket } from '@/features/admin/actions';

function Control({ label, run }: { label: string; run: (reason: string) => Promise<{ ok: boolean; message?: string }> }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const router = useRouter();
  return <span className="admin-action"><button disabled={pending} onClick={() => { const reason = window.prompt('请输入操作原因（至少 2 个字）'); if (!reason) return; startTransition(async () => { const result = await run(reason); setMessage(result.ok ? '完成' : result.message ?? '失败'); if (result.ok) router.refresh(); }); }}>{pending ? '处理中…' : label}</button>{message && <small role="status">{message}</small>}</span>;
}

export function UserStatusControls({ userId, status }: { userId: string; status: string }) {
  if (status === 'deleted') return <span>已完成注销</span>;
  if (status === 'deletion_requested') return <span className="admin-action-group"><Control label="撤销注销申请" run={(reason) => setUserStatus({ userId, status: 'active', reason })} /><Control label="完成注销" run={(reason) => completeAccountDeletion({ userId, notes: reason })} /></span>;
  return <span className="admin-action-group"><Control label={status === 'banned' ? '解除封禁' : '封禁'} run={(reason) => setUserStatus({ userId, status: status === 'banned' ? 'active' : 'banned', reason })} /></span>;
}

export function ActivityCreatorEligibilityControl({ userId, approved, requested }: { userId: string; approved: boolean; requested: boolean }) {
  if (requested && !approved) return <span className="admin-action-group"><Control label="通过活动资格" run={(reason) => setActivityCreatorEligibility({ userId, approved: true, reason })} /><Control label="拒绝活动资格" run={(reason) => setActivityCreatorEligibility({ userId, approved: false, reason })} /></span>;
  return <Control label={approved ? '撤销活动资格' : '开通活动资格'} run={(reason) => setActivityCreatorEligibility({ userId, approved: !approved, reason })} />;
}

export function UserRoleControl({ userId, role }: { userId: string; role: string }) {
  const [open, setOpen] = useState(false); const [message, setMessage] = useState(''); const [pending, startTransition] = useTransition(); const router = useRouter();
  if (!open) return <button onClick={() => setOpen(true)}>角色：{role}</button>;
  return <form className="inline-admin-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await setUserRole({ userId, role: data.get('role'), reason: data.get('reason') }); setMessage(result.ok ? '角色已更新' : result.message); if (result.ok) { setOpen(false); router.refresh(); } }); }}><select name="role" defaultValue={role}><option value="user">用户</option><option value="editor">编辑</option><option value="city_admin">城市管理员</option><option value="platform_admin">平台管理员</option></select><input name="reason" minLength={2} placeholder="变更原因" required /><button disabled={pending}>确认变更</button><button type="button" onClick={() => setOpen(false)}>取消</button><small role="status">{message}</small></form>;
}

export function PostModerationControls({ postId, status }: { postId: string; status: string }) {
  return <span className="admin-action-group">{status !== 'published' && status !== 'deleted' && <Control label="发布" run={(reason) => moderatePost({ postId, targetStatus: 'published', reason })} />}{status === 'published' && <Control label="隐藏" run={(reason) => moderatePost({ postId, targetStatus: 'hidden', reason })} />}{status !== 'deleted' && <Control label="删除" run={(reason) => moderatePost({ postId, targetStatus: 'deleted', reason })} />}{status === 'deleted' && <Control label="恢复为隐藏" run={(reason) => moderatePost({ postId, targetStatus: 'hidden', reason })} />}</span>;
}

export function CommentModerationControls({ commentId, status }: { commentId: string; status: string }) {
  return <span className="admin-action-group">{status !== 'published' && status !== 'deleted' && <Control label="发布" run={(reason) => moderateComment({ commentId, targetStatus: 'published', reason })} />}{status === 'published' && <Control label="隐藏" run={(reason) => moderateComment({ commentId, targetStatus: 'hidden', reason })} />}{status !== 'deleted' && <Control label="删除" run={(reason) => moderateComment({ commentId, targetStatus: 'deleted', reason })} />}</span>;
}

export function ActivityReviewControls({ activityId, status }: { activityId: string; status: string }) {
  return <span className="admin-action-group">{['draft', 'pending'].includes(status) && <Control label="通过" run={(reason) => reviewActivity({ activityId, targetStatus: 'published', reason })} />}{!['cancelled', 'ended'].includes(status) && <Control label="取消" run={(reason) => reviewActivity({ activityId, targetStatus: 'cancelled', reason })} />}{status === 'published' && <Control label="结束" run={(reason) => reviewActivity({ activityId, targetStatus: 'ended', reason })} />}</span>;
}

export function MediaReviewControls({ mediaId, status }: { mediaId: string; status: string }) {
  return <span className="admin-action-group">{['uploaded', 'rejected'].includes(status) && <Control label="审核通过" run={(reason) => reviewMedia({ mediaId, decision: 'approved', reason })} />}{status === 'uploaded' && <Control label="拒绝" run={(reason) => reviewMedia({ mediaId, decision: 'rejected', reason })} />}</span>;
}

export function ReportReviewControls({ reportId }: { reportId: string }) {
  return <span className="admin-action-group"><Control label="举报成立" run={(notes) => closeReport({ reportId, decision: 'approved', notes })} /><Control label="举报驳回" run={(notes) => closeReport({ reportId, decision: 'rejected', notes })} /></span>;
}

export function AppealReviewControls({ appealId }: { appealId: string }) {
  return <span className="admin-action-group"><Control label="申诉通过" run={(notes) => reviewAppeal({ appealId, decision: 'approved', notes })} /><Control label="申诉驳回" run={(notes) => reviewAppeal({ appealId, decision: 'rejected', notes })} /></span>;
}

export function CityAdminControl({ cityId, users }: { cityId: string; users: Array<{ id: string; nickname: string; role: string }> }) {
  const [open, setOpen] = useState(false); const [message, setMessage] = useState(''); const [pending, startTransition] = useTransition(); const router = useRouter();
  if (!open) return <button onClick={() => setOpen(true)}>管理城市管理员</button>;
  return <form className="inline-admin-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await setCityAdmin({ cityId, userId: data.get('userId'), enabled: data.get('operation') === 'assign', reason: data.get('reason') }); setMessage(result.ok ? '城市管理员已更新' : result.message); if (result.ok) { setOpen(false); router.refresh(); } }); }}><select name="userId" required><option value="">选择用户</option>{users.map((user) => <option value={user.id} key={user.id}>{user.nickname} · {user.role} · {user.id.slice(0, 8)}</option>)}</select><select name="operation"><option value="assign">分配</option><option value="remove">移除</option></select><input name="reason" minLength={2} placeholder="变更原因" required /><button disabled={pending}>确认</button><button type="button" onClick={() => setOpen(false)}>取消</button><small role="status">{message}</small></form>;
}

export function ApplicationReviewControls({ kind, applicationId, status }: { kind: 'organization'; applicationId: string; status: string }) {
  if (!['submitted', 'reviewing'].includes(status)) return <span>已处理</span>;
  return <span className="admin-action-group"><Control label="通过" run={(notes) => reviewApplication({ kind, applicationId, decision: 'approved', notes })} /><Control label="拒绝" run={(notes) => reviewApplication({ kind, applicationId, decision: 'rejected', notes })} /></span>;
}

export function HelpTicketReviewControl({ ticketId, status }: { ticketId: string; status: string }) {
  if (['resolved', 'closed'].includes(status)) return <span>已处理</span>;
  return <span className="admin-action-group">{status === 'open' ? <Control label="领取工单" run={async () => startHelpTicket(ticketId)} /> : null}<Control label="完成工单" run={(resolution) => resolveHelpTicket({ ticketId, resolution })} /></span>;
}

export function DeadLetterControl({ deadLetterId, status }: { deadLetterId: string; status: string }) {
  if (status !== 'open') return <span>已处置</span>;
  return <span className="admin-action-group"><Control label="重放" run={(notes) => resolveDeadLetter({ deadLetterId, action: 'replay', notes })} /><Control label="忽略" run={(notes) => resolveDeadLetter({ deadLetterId, action: 'ignore', notes })} /></span>;
}
