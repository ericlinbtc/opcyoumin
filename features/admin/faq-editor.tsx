'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveManagedFaq } from '@/features/admin/actions';

type FaqValue = { id?: string; slug: string; category: string; question: string; answer: string; sortOrder: number; status: 'draft' | 'pending' | 'published' | 'hidden' | 'deleted' };
const empty: FaqValue = { slug: '', category: '', question: '', answer: '', sortOrder: 0, status: 'draft' };

export function FaqEditor({ value = empty }: { value?: FaqValue }) {
  const [open, setOpen] = useState(!value.id); const [message, setMessage] = useState(''); const [pending, startTransition] = useTransition(); const router = useRouter();
  if (!open) return <button onClick={() => setOpen(true)}>编辑</button>;
  return <form className="managed-content-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await saveManagedFaq({ id: value.id, slug: data.get('slug'), category: data.get('category'), question: data.get('question'), answer: data.get('answer'), sortOrder: Number(data.get('sortOrder')), status: data.get('status') }); setMessage(result.ok ? '常见问题已保存' : result.message); if (result.ok) { setOpen(false); router.refresh(); } }); }}><input name="slug" defaultValue={value.slug} placeholder="url-slug" required /><input name="category" defaultValue={value.category} placeholder="分类" required /><input name="question" defaultValue={value.question} placeholder="问题" required /><textarea name="answer" defaultValue={value.answer} placeholder="答案" required /><input name="sortOrder" type="number" min="0" defaultValue={value.sortOrder} aria-label="排序" /><select name="status" defaultValue={value.status}><option value="draft">草稿</option><option value="pending">待审核</option><option value="published">发布</option><option value="hidden">隐藏</option><option value="deleted">删除</option></select><button disabled={pending}>{pending ? '保存中…' : '保存常见问题'}</button>{value.id ? <button type="button" onClick={() => setOpen(false)}>取消</button> : null}<small role="status">{message}</small></form>;
}
