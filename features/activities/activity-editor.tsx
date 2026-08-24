'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createActivity, requestActivityCreatorEligibility } from '@/features/activities/actions';

export function ActivityCreatorApplication({ requested }: { requested: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const router = useRouter();
  return <div className="empty-state"><p>{requested ? '活动发起资格正在审核中。' : '普通用户通过审核后可以在已加入的城市发起活动。'}</p>{!requested && <button className="primary-product-button" disabled={pending} onClick={() => startTransition(async () => { const result = await requestActivityCreatorEligibility(); setMessage(result.ok ? '申请已提交' : result.message); if (result.ok) router.refresh(); })}>{pending ? '提交中…' : '申请活动发起资格'}</button>}<small role="status">{message}</small></div>;
}

export function ActivityCreator({ cities }: { cities: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!open) return <button className="primary-product-button" onClick={() => setOpen(true)}>发布活动</button>;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createActivity({ cityId: data.get('cityId'), title: data.get('title'), summary: data.get('summary'), details: data.get('details'), location: data.get('location'), capacity: Number(data.get('capacity')), startsAt: data.get('startsAt'), endsAt: data.get('endsAt') });
      setMessage(result.ok ? '活动已提交审核' : result.message);
      if (result.ok) { setOpen(false); router.refresh(); }
    });
  }
  return <form className="composer-form activity-editor" onSubmit={submit}><h2>发布新活动</h2><label htmlFor="activity-city">城市</label><select id="activity-city" name="cityId" required>{cities.map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select><label htmlFor="activity-title">活动名称</label><input id="activity-title" name="title" required maxLength={120} /><label htmlFor="activity-summary">活动摘要</label><textarea id="activity-summary" name="summary" required minLength={10} maxLength={500} /><label htmlFor="activity-details">活动详情</label><textarea id="activity-details" name="details" required minLength={20} /><label htmlFor="activity-location">地点</label><input id="activity-location" name="location" required maxLength={240} /><label htmlFor="activity-capacity">名额</label><input id="activity-capacity" name="capacity" type="number" min="1" max="10000" required /><label htmlFor="activity-start">开始时间</label><input id="activity-start" name="startsAt" type="datetime-local" required /><label htmlFor="activity-end">结束时间</label><input id="activity-end" name="endsAt" type="datetime-local" required /><button disabled={pending}>{pending ? '提交中…' : '提交审核'}</button><button type="button" onClick={() => setOpen(false)}>取消</button><small role="status">{message}</small></form>;
}
