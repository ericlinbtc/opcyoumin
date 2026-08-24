'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead, requestAccountDeletion, revokeSession, updateProfile } from '@/features/account/actions';

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
  return <div className="media-uploader"><label htmlFor="profile-avatar">头像（JPEG、PNG 或 WebP，≤10MB）</label><input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setPending(true); try { const response = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, mimeType: file.type, byteSize: file.size }) }); const payload = await response.json() as { ok: boolean; data?: { uploadUrl: string; headers: Record<string, string> }; error?: { message?: string } }; if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? '无法创建上传凭证'); const uploaded = await fetch(payload.data.uploadUrl, { method: 'PUT', headers: payload.data.headers, body: file }); if (!uploaded.ok) throw new Error('头像上传失败'); setMessage('头像已上传，审核通过后将自动更新。'); } catch (error) { setMessage(error instanceof Error ? error.message : '头像上传失败'); } finally { setPending(false); event.target.value = ''; } }} /><small role="status">{pending ? '上传中…' : message}</small></div>;
}

export function RevokeSessionButton({ sessionId, current }: { sessionId: string; current: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(async () => { const result = await revokeSession(sessionId); if (result.ok) { if (current) router.push('/login'); router.refresh(); } })}>{pending ? '撤销中…' : current ? '退出当前设备' : '撤销会话'}</button>;
}

export function MarkNotificationsReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(async () => { const result = await markAllNotificationsRead(); if (result.ok) router.refresh(); })}>{pending ? '处理中…' : '全部标为已读'}</button>;
}

export function AccountDeletionControl() {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <section className="danger-zone"><h2>注销账号</h2><p>提交后账号将立即停止登录，运营人员会按隐私规则处理数据删除申请。</p><button disabled={pending} onClick={() => { const confirmation = window.prompt('请输入 DELETE 确认提交注销申请'); if (confirmation !== 'DELETE') return setMessage('未提交：确认文本不匹配'); startTransition(async () => { const result = await requestAccountDeletion(confirmation); setMessage(result.ok ? '注销申请已提交' : result.message); if (result.ok) router.push('/login'); }); }}>{pending ? '提交中…' : '申请注销账号'}</button><small role="status">{message}</small></section>;
}
