'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelOwnActivity, editActivity } from '@/features/activities/actions';

type ActivityValue = { id: string; cityId: string; title: string; summary: string; details: string; location: string; capacity: number; startsAt: Date; endsAt: Date; status: string };

function localDateTime(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function ActivityOwnerControls({ activity }: { activity: ActivityValue }) {
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (editing) return <form className="composer-form compact" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await editActivity({ activityId: activity.id, activity: { cityId: activity.cityId, title: data.get('title'), summary: data.get('summary'), details: data.get('details'), location: data.get('location'), capacity: Number(data.get('capacity')), startsAt: data.get('startsAt'), endsAt: data.get('endsAt') } }); setMessage(result.ok ? '活动已重新提交审核' : result.message); if (result.ok) { setEditing(false); router.refresh(); } }); }}><input name="title" defaultValue={activity.title} required /><textarea name="summary" defaultValue={activity.summary} required /><textarea name="details" defaultValue={activity.details} required /><input name="location" defaultValue={activity.location} required /><input name="capacity" type="number" min="1" defaultValue={activity.capacity} required /><input name="startsAt" type="datetime-local" defaultValue={localDateTime(new Date(activity.startsAt))} required /><input name="endsAt" type="datetime-local" defaultValue={localDateTime(new Date(activity.endsAt))} required /><button disabled={pending}>保存并提交审核</button><button type="button" onClick={() => setEditing(false)}>取消编辑</button><small role="status">{message}</small></form>;
  return <span className="owner-controls">{['draft', 'pending'].includes(activity.status) && <button onClick={() => setEditing(true)}>编辑活动</button>}{!['cancelled', 'ended'].includes(activity.status) && <button disabled={pending} onClick={() => { if (!window.confirm('确认取消活动？已报名用户会收到站内通知。')) return; startTransition(async () => { const result = await cancelOwnActivity(activity.id); setMessage(result.ok ? '活动已取消' : result.message); if (result.ok) router.refresh(); }); }}>取消活动</button>}<small role="status">{message}</small></span>;
}
