'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveManagedContent } from '@/features/admin/actions';

type ContentValue = { id?: string; kind: 'knowledge' | 'insight'; slug: string; title: string; summary: string; body: string; category: string; sourceName: string | null; sourceUrl: string | null; factCheckedAt: Date | null; importance: number; status: 'draft' | 'pending' | 'published' | 'hidden' | 'deleted' };
const empty: ContentValue = { kind: 'knowledge', slug: '', title: '', summary: '', body: '', category: '', sourceName: '', sourceUrl: '', factCheckedAt: null, importance: 1, status: 'draft' };

export function ContentEditor({ value = empty }: { value?: ContentValue }) {
  const [open, setOpen] = useState(!value.id);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveManagedContent({ id: value.id, kind: data.get('kind'), slug: data.get('slug'), title: data.get('title'), summary: data.get('summary'), body: data.get('body'), category: data.get('category'), sourceName: data.get('sourceName'), sourceUrl: data.get('sourceUrl'), factCheckedAt: data.get('factCheckedAt') || undefined, importance: Number(data.get('importance')), status: data.get('status') });
      setMessage(result.ok ? '保存成功' : result.message);
      if (result.ok) { setOpen(false); router.refresh(); }
    });
  }
  if (!open) return <button onClick={() => setOpen(true)}>编辑</button>;
  return <form className="managed-content-form" onSubmit={submit}><select name="kind" defaultValue={value.kind} aria-label="内容类型"><option value="knowledge">知识</option><option value="insight">AI 洞察</option></select><input name="slug" defaultValue={value.slug} placeholder="url-slug" required /><input name="title" defaultValue={value.title} placeholder="标题" required /><input name="category" defaultValue={value.category} placeholder="分类" required /><textarea name="summary" defaultValue={value.summary} placeholder="摘要（至少 10 字）" required /><textarea name="body" defaultValue={value.body} placeholder="正文：支持 ## 标题、- 列表、> 引用和 Markdown 链接" required /><input name="sourceName" defaultValue={value.sourceName ?? ''} placeholder="来源名称" /><input name="sourceUrl" type="url" defaultValue={value.sourceUrl ?? ''} placeholder="https:// 原始来源" /><label>事实核验时间<input name="factCheckedAt" type="datetime-local" defaultValue={value.factCheckedAt ? new Date(value.factCheckedAt.getTime() - value.factCheckedAt.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''} /></label><input name="importance" type="number" min="1" max="5" defaultValue={value.importance} aria-label="重要程度" /><select name="status" defaultValue={value.status} aria-label="发布状态"><option value="draft">草稿</option><option value="pending">待审核</option><option value="published">发布</option><option value="hidden">隐藏</option><option value="deleted">删除</option></select><button disabled={pending}>{pending ? '保存中…' : '保存'}</button>{value.id && <button type="button" onClick={() => setOpen(false)}>取消</button>}<small role="status">{message}</small></form>;
}
