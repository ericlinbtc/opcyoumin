'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cleanInactiveSessions, markAllNotificationsRead, markNotificationRead, requestAccountDeletion, revokeSession, updateProfile } from '@/features/account/actions';
import { closeOwnHelpTicket, replyToHelpTicket } from '@/features/applications/actions';

export function ProfileEditor({ profile }: { profile: { nickname: string; bio: string | null; occupationTags: string[] } }) {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateProfile({ nickname: form.get('nickname'), bio: form.get('bio'), occupationTags: String(form.get('occupationTags') ?? '').split(/[，,]/).map((item) => item.trim()).filter(Boolean) });
      setMessage(result.ok ? '个人资料已保存' : result.message);
    });
  }
  return <form className="composer-form account-editor" onSubmit={submit}><h2>公开资料</h2><AvatarUploader /><label htmlFor="nickname">昵称</label><input id="nickname" name="nickname" defaultValue={profile.nickname} minLength={2} maxLength={40} required /><label htmlFor="bio">个人简介</label><textarea id="bio" name="bio" defaultValue={profile.bio ?? ''} maxLength={280} /><label htmlFor="occupationTags">职业标签（逗号分隔）</label><input id="occupationTags" name="occupationTags" defaultValue={profile.occupationTags.join(', ')} /><button disabled={pending}>{pending ? '保存中…' : '保存资料'}</button><p className="form-message" role="status">{message}</p></form>;
}

function AvatarUploader() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('上传新头像后需经过媒体审核才会公开。');
  const router = useRouter();
  return <div className="media-uploader"><label htmlFor="profile-avatar">头像（JPEG、PNG 或 WebP，≤10MB）</label><input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setPending(true); try { const response = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, mimeType: file.type, byteSize: file.size }) }); const payload = await response.json() as { ok: boolean; data?: { mediaId: string; uploadUrl: string; headers: Record<string, string> }; error?: { message?: string } }; if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? '无法创建上传凭证'); const uploaded = await fetch(payload.data.uploadUrl, { method: 'PUT', headers: payload.data.headers, body: file }); if (!uploaded.ok) throw new Error('头像上传失败'); setMessage('头像已上传，正在等待审核。'); for (let attempt = 0; attempt < 30; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 2_000)); const statusResponse = await fetch(`/api/uploads/${payload.data.mediaId}`, { cache: 'no-store' }); const statusPayload = await statusResponse.json() as { data?: { status: string; published: boolean } }; if (statusPayload.data?.published) { setMessage('头像审核通过并已更新。'); router.refresh(); break; } if (statusPayload.data?.status === 'rejected') { setMessage('头像未通过审核，请更换图片后重试。'); break; } if (attempt === 29) setMessage('头像仍在审核中，稍后刷新页面可查看结果。'); } } catch (error) { setMessage(error instanceof Error ? error.message : '头像上传失败'); } finally { setPending(false); event.target.value = ''; } }} /><small role="status">{message}</small></div>;
}

export function RevokeSessionButton({ sessionId, current }: { sessionId: string; current: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(async () => { const result = await revokeSession(sessionId); if (result.ok) { if (current) router.push('/login'); router.refresh(); } })}>{pending ? '撤销中…' : current ? '退出当前设备' : '撤销会话'}</button>;
}

export function CleanInactiveSessionsButton() {
  const router = useRouter(); const [message, setMessage] = useState(''); const [pending, startTransition] = useTransition();
  return <span className="admin-action"><button disabled={pending} onClick={() => startTransition(async () => { const result = await cleanInactiveSessions(); setMessage(result.ok ? `已清理 ${result.data?.removed ?? 0} 个失效会话` : result.message); if (result.ok) router.refresh(); })}>{pending ? '清理中…' : '清理已过期/已撤销会话'}</button><small role="status">{message}</small></span>;
}

export function MarkNotificationsReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(async () => { const result = await markAllNotificationsRead(); if (result.ok) router.refresh(); })}>{pending ? '处理中…' : '全部标为已读'}</button>;
}

export function MarkNotificationReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(async () => { const result = await markNotificationRead(notificationId); if (result.ok) router.refresh(); })}>{pending ? '处理中…' : '标为已读'}</button>;
}

export function HelpTicketControl({ ticketId, canReply, canClose }: { ticketId: string; canReply: boolean; canClose: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  return <div className="inline-admin-form">{canReply ? <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); startTransition(async () => { const result = await replyToHelpTicket({ ticketId, body: form.get('body') }); setMessage(result.ok ? '追问已提交' : result.message); if (result.ok) { event.currentTarget.reset(); router.refresh(); } }); }}><label><span>追加说明</span><textarea name="body" required minLength={2} maxLength={3000} rows={3} /></label><button disabled={pending}>{pending ? '提交中…' : '提交追问'}</button></form> : null}{canClose ? <button disabled={pending} onClick={() => startTransition(async () => { const result = await closeOwnHelpTicket(ticketId); setMessage(result.ok ? '工单已关闭' : result.message); if (result.ok) router.refresh(); })}>{pending ? '处理中…' : '确认解决并关闭'}</button> : null}<small role="status">{message}</small></div>;
}

export function AccountDeletionControl() {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <section className="danger-zone"><h2>注销账号</h2><p>提交后账号将立即停止登录，运营人员会按隐私规则处理数据删除申请。</p><button disabled={pending} onClick={() => { const confirmation = window.prompt('请输入 DELETE 确认提交注销申请'); if (confirmation !== 'DELETE') return setMessage('未提交：确认文本不匹配'); startTransition(async () => { const result = await requestAccountDeletion(confirmation); setMessage(result.ok ? '注销申请已提交' : result.message); if (result.ok) router.push('/login'); }); }}>{pending ? '提交中…' : '申请注销账号'}</button><small role="status">{message}</small></section>;
}
