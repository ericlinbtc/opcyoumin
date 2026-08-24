'use client';

import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useId, useState, useTransition } from 'react';
import { registerActivity, cancelRegistration } from '@/features/activities/actions';
import { joinCity, leaveCity } from '@/features/cities/actions';
import { createAppeal, createReport, recordShare, toggleBlock, toggleFollow, toggleReaction, toggleSave, votePoll } from '@/features/interactions/actions';
import { createComment, createPost, deleteOwnPost, editOwnPost } from '@/features/posts/actions';

type Feedback = { kind: 'success' | 'error'; message: string } | null;

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <p className={`action-feedback ${feedback.kind}`} role="status">{feedback.message}</p>;
}

export function CityMembershipControl({ cityId, initialJoined }: { cityId: string; initialJoined: boolean }) {
  const router = useRouter();
  const [joined, setJoined] = useState(initialJoined);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  return <div className="action-control"><button disabled={pending} onClick={() => startTransition(async () => {
    const result = joined ? await leaveCity(cityId) : await joinCity(cityId);
    if (!result.ok) return setFeedback({ kind: 'error', message: result.message });
    setJoined(!joined);
    setFeedback({ kind: 'success', message: joined ? '已退出城市' : '已加入城市' });
    router.refresh();
  })}>{pending ? '处理中…' : joined ? '退出城市' : '加入城市'}</button><FeedbackLine feedback={feedback} /></div>;
}

export function PostComposer({ cityId }: { cityId: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [withPoll, setWithPoll] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createPost({
        cityId,
        content: String(data.get('content') ?? ''),
        topics: String(data.get('topics') ?? '').split(/[，,]/).map((item) => item.trim()).filter(Boolean),
        mediaIds,
        poll: withPoll ? { question: String(data.get('pollQuestion') ?? ''), options: String(data.get('pollOptions') ?? '').split(/\n/).map((item) => item.trim()).filter(Boolean), closesAt: data.get('pollClosesAt') || undefined } : undefined,
      });
      if (!result.ok) return setFeedback({ kind: 'error', message: result.message });
      form.reset();
      setMediaIds([]);
      setFeedback({ kind: 'success', message: result.data?.status === 'pending' ? '动态已提交审核' : '动态发布成功' });
      if (result.data?.status === 'published') router.push(`/posts/${result.data.postId}`);
      router.refresh();
    });
  }
  return <form className="composer-form" onSubmit={submit}><label htmlFor="post-content">发布城市动态</label><textarea id="post-content" name="content" minLength={1} maxLength={5000} required placeholder="分享一个真实的问题、经验或合作机会…" /><label htmlFor="post-topics">话题（逗号分隔，最多 8 个）</label><input id="post-topics" name="topics" maxLength={240} placeholder="一人公司, 城市连接" /><MediaUploader mediaIds={mediaIds} onChange={setMediaIds} /><label className="checkbox-label"><input type="checkbox" checked={withPoll} onChange={(event) => setWithPoll(event.target.checked)} /> 添加投票</label>{withPoll && <fieldset className="poll-editor"><legend>投票设置</legend><label htmlFor="poll-question">问题</label><input id="poll-question" name="pollQuestion" required maxLength={240} /><label htmlFor="poll-options">选项（每行一个，2–6 个）</label><textarea id="poll-options" name="pollOptions" required placeholder={'选项一\n选项二'} /><label htmlFor="poll-closes">截止时间（可选）</label><input id="poll-closes" name="pollClosesAt" type="datetime-local" /></fieldset>}<button disabled={pending} type="submit">{pending ? '发布中…' : '发布动态'}</button><FeedbackLine feedback={feedback} /></form>;
}

function MediaUploader({ mediaIds, onChange }: { mediaIds: string[]; onChange: (ids: string[]) => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length + mediaIds.length > 9) return setMessage('图片和视频合计最多 9 个');
    if (files.filter((file) => file.type.startsWith('video/')).length > 1) return setMessage('每条动态最多上传 1 个视频');
    setPending(true);
    try {
      const ids: string[] = [];
      for (const file of files) {
        const response = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, mimeType: file.type, byteSize: file.size }) });
        const payload = await response.json() as { ok: boolean; data?: { mediaId: string; uploadUrl: string; headers: Record<string, string> }; error?: { message?: string } };
        if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? '无法创建上传凭证');
        const uploaded = await fetch(payload.data.uploadUrl, { method: 'PUT', headers: payload.data.headers, body: file });
        if (!uploaded.ok) throw new Error(`文件 ${file.name} 上传失败`);
        ids.push(payload.data.mediaId);
      }
      onChange([...mediaIds, ...ids]);
      setMessage(`已上传 ${ids.length} 个文件`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setPending(false);
      event.target.value = '';
    }
  }
  return <div className="media-uploader"><label htmlFor="post-media">图片或视频（图片 ≤10MB，视频 ≤200MB）</label><input id="post-media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple disabled={pending} onChange={upload} /><small role="status">{pending ? '上传中…' : message || `${mediaIds.length}/9 个文件`}</small></div>;
}

export function PostOwnerControls({ postId, content }: { postId: string; content: string }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (editing) return <form className="composer-form compact" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); startTransition(async () => { const result = await editOwnPost({ postId, content: form.get('content'), topics: [] }); setMessage(result.ok ? '保存成功' : result.message); if (result.ok) { setEditing(false); router.refresh(); } }); }}><textarea name="content" defaultValue={content} required maxLength={5000} /><button disabled={pending}>保存修改</button><button type="button" onClick={() => setEditing(false)}>取消</button><small role="status">{message}</small></form>;
  return <span className="owner-controls"><button onClick={() => setEditing(true)}>编辑</button><button onClick={() => { if (!window.confirm('确认删除这条动态？删除后仅管理员可以恢复。')) return; startTransition(async () => { const result = await deleteOwnPost(postId); setMessage(result.ok ? '已删除' : result.message); if (result.ok) router.refresh(); }); }} disabled={pending}>删除</button><small role="status">{message}</small></span>;
}

export function CommentComposer({ postId, parentId, compact = false }: { postId: string; parentId?: string; compact?: boolean }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get('content') ?? '');
    startTransition(async () => {
      const result = await createComment({ postId, parentId, content });
      if (!result.ok) return setFeedback({ kind: 'error', message: result.message });
      form.reset();
      setFeedback({ kind: 'success', message: result.data?.status === 'pending' ? '评论已提交审核' : '评论发布成功' });
      router.refresh();
    });
  }
  const fieldId = useId();
  return <form className={`composer-form compact${compact ? ' nested' : ''}`} onSubmit={submit}><label htmlFor={fieldId}>{parentId ? '回复这条评论' : '参与讨论'}</label><textarea id={fieldId} name="content" minLength={1} maxLength={1000} required placeholder="写下你的回复…" /><button disabled={pending} type="submit">{pending ? '提交中…' : parentId ? '提交回复' : '发表评论'}</button><FeedbackLine feedback={feedback} /></form>;
}

export function ReplyControl({ postId, parentId }: { postId: string; parentId: string }) {
  const [open, setOpen] = useState(false);
  return <div className="reply-control"><button onClick={() => setOpen(!open)}>{open ? '取消回复' : '回复'}</button>{open && <CommentComposer postId={postId} parentId={parentId} compact />}</div>;
}

export function PostInteractionControls({ postId, initiallyReacted, initiallySaved, reactionCount, saveCount, shareCount }: { postId: string; initiallyReacted: boolean; initiallySaved: boolean; reactionCount: number; saveCount: number; shareCount: number }) {
  const [reacted, setReacted] = useState(initiallyReacted);
  const [saved, setSaved] = useState(initiallySaved);
  const [likes, setLikes] = useState(reactionCount);
  const [saves, setSaves] = useState(saveCount);
  const [shares, setShares] = useState(shareCount);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const mutate = (kind: 'reaction' | 'save') => startTransition(async () => {
    const result = kind === 'reaction' ? await toggleReaction(postId) : await toggleSave(postId);
    if (!result.ok) return setFeedback({ kind: 'error', message: result.message });
    const active = Boolean(result.data?.active);
    if (kind === 'reaction') { setReacted(active); setLikes((value) => Math.max(0, value + (active ? 1 : -1))); }
    else { setSaved(active); setSaves((value) => Math.max(0, value + (active ? 1 : -1))); }
    setFeedback(null);
  });
  return <div className="interaction-controls"><button aria-pressed={reacted} disabled={pending} onClick={() => mutate('reaction')}>{reacted ? '已点赞' : '点赞'} · {likes}</button><button aria-pressed={saved} disabled={pending} onClick={() => mutate('save')}>{saved ? '已收藏' : '收藏'} · {saves}</button><button onClick={() => startTransition(async () => { const result = await recordShare(postId); if (result.ok && result.data?.counted) setShares((value) => value + 1); if (navigator.share) await navigator.share({ title: document.title, url: location.href }); else await navigator.clipboard.writeText(location.href); })}>分享 · {shares}</button><FeedbackLine feedback={feedback} /></div>;
}

export function FollowControl({ memberId, initialFollowing }: { memberId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  return <div className="action-control"><button aria-pressed={following} disabled={pending} onClick={() => startTransition(async () => {
    const result = await toggleFollow(memberId);
    if (!result.ok) return setFeedback({ kind: 'error', message: result.message });
    setFollowing(Boolean(result.data?.active));
    setFeedback(null);
  })}>{pending ? '处理中…' : following ? '取消关注' : '关注'}</button><FeedbackLine feedback={feedback} /></div>;
}

export function BlockControl({ memberId, initialBlocked }: { memberId: string; initialBlocked: boolean }) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  return <span className="owner-controls"><button disabled={pending} onClick={() => { if (!blocked && !window.confirm('屏蔽后双方关注关系会解除，你将不再看到对方的城市动态。确认继续？')) return; startTransition(async () => { const result = await toggleBlock(memberId); if (result.ok) setBlocked(Boolean(result.data?.active)); else setMessage(result.message); }); }}>{pending ? '处理中…' : blocked ? '解除屏蔽' : '屏蔽用户'}</button><small role="status">{message}</small></span>;
}

export function ActivityRegistrationControl({ activityId, initialRegistered }: { activityId: string; initialRegistered: boolean }) {
  const [registered, setRegistered] = useState(initialRegistered);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="action-control"><button disabled={pending} onClick={() => startTransition(async () => {
    const result = registered ? await cancelRegistration(activityId) : await registerActivity(activityId);
    if (!result.ok) return setFeedback({ kind: 'error', message: result.message });
    setRegistered(!registered);
    setFeedback({ kind: 'success', message: registered ? '已取消报名' : '报名成功' });
    router.refresh();
  })}>{pending ? '处理中…' : registered ? '取消报名' : '立即报名'}</button><FeedbackLine feedback={feedback} /></div>;
}

export function PollControl({ poll }: { poll: { id: string; question: string; options: Array<{ id: string; label: string; votes: number }>; closesAt: Date | null; viewerVoted: boolean } }) {
  const [voted, setVoted] = useState(poll.viewerVoted);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const total = poll.options.reduce((sum, option) => sum + option.votes, 0);
  return <section className="post-poll"><h2>{poll.question}</h2>{poll.options.map((option) => <button key={option.id} disabled={pending || voted || Boolean(poll.closesAt && new Date(poll.closesAt) <= new Date())} onClick={() => startTransition(async () => { const result = await votePoll({ pollId: poll.id, optionId: option.id }); setMessage(result.ok ? '投票成功' : result.message); if (result.ok) { setVoted(true); router.refresh(); } })}><span>{option.label}</span><strong>{option.votes} 票 · {total ? Math.round(option.votes / total * 100) : 0}%</strong></button>)}<small role="status">{message || (voted ? '你已参与投票' : poll.closesAt ? `截止 ${new Date(poll.closesAt).toLocaleString('zh-CN')}` : `${total} 人参与`)}</small></section>;
}

export function ReportControl({ targetType, targetId }: { targetType: 'post' | 'comment' | 'activity' | 'user'; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  if (!open) return <button className="report-trigger" onClick={() => setOpen(true)}>举报</button>;
  return <form className="report-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await createReport({ targetType, targetId, reason: data.get('reason'), details: data.get('details') }); setMessage(result.ok ? '举报已提交，平台将按规则核查' : result.message); if (result.ok) setOpen(false); }); }}><label>举报原因<select name="reason" required><option value="违法违规内容">违法违规内容</option><option value="骚扰或人身攻击">骚扰或人身攻击</option><option value="垃圾广告">垃圾广告</option><option value="虚假信息">虚假信息</option><option value="其他问题">其他问题</option></select></label><label>补充说明<textarea name="details" maxLength={1000} /></label><button disabled={pending}>{pending ? '提交中…' : '提交举报'}</button><button type="button" onClick={() => setOpen(false)}>取消</button><small role="status">{message}</small></form>;
}

export function AppealControl({ targetType, targetId }: { targetType: 'post' | 'comment' | 'activity'; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  if (!open) return <button className="report-trigger" onClick={() => setOpen(true)}>提交申诉</button>;
  return <form className="report-form" onSubmit={(event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get('reason'); startTransition(async () => { const result = await createAppeal({ targetType, targetId, reason }); setMessage(result.ok ? '申诉已提交' : result.message); if (result.ok) setOpen(false); }); }}><label>申诉理由<textarea name="reason" minLength={10} maxLength={1000} required /></label><button disabled={pending}>{pending ? '提交中…' : '提交申诉'}</button><button type="button" onClick={() => setOpen(false)}>取消</button><small role="status">{message}</small></form>;
}
