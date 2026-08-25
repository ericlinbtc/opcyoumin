'use client';

import { FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { applyToOrganization, leaveOrganization, withdrawOrganizationApplication } from '@/features/applications/actions';

export function OrganizationControls({ organizationId, membershipRole, applicationId, applicationStatus }: { organizationId: string; membershipRole: string | null; applicationId: string | null; applicationStatus: string | null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (membershipRole) return <div className="owner-controls"><span>你已加入该机构 · {membershipRole}</span><button disabled={pending} onClick={() => { if (!window.confirm('确认退出该机构？')) return; startTransition(async () => { const result = await leaveOrganization(organizationId); setMessage(result.ok ? '已退出机构' : result.message); if (result.ok) router.refresh(); }); }}>退出机构</button><small role="status">{message}</small></div>;
  if (applicationId && ['submitted', 'reviewing'].includes(applicationStatus ?? '')) return <div className="owner-controls"><span>申请状态：{applicationStatus}</span><button disabled={pending} onClick={() => startTransition(async () => { const result = await withdrawOrganizationApplication(applicationId); setMessage(result.ok ? '申请已撤回，可重新提交' : result.message); if (result.ok) router.refresh(); })}>撤回申请</button><small role="status">{message}</small></div>;
  if (!open) return <div className="owner-controls"><button className="primary-product-button" onClick={() => setOpen(true)}>{applicationStatus === 'rejected' || applicationStatus === 'cancelled' ? '重新申请加入' : '申请加入机构'}</button>{applicationStatus === 'rejected' && <small>上次申请未通过，可以补充说明后重新提交。</small>}</div>;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await applyToOrganization({ organizationId, motivation: form.get('motivation') });
      setMessage(result.ok ? '申请已提交' : result.message);
      if (result.ok) { setOpen(false); router.refresh(); }
    });
  }

  return <form className="composer-form compact" onSubmit={submit}><label htmlFor="organization-motivation">申请说明</label><textarea id="organization-motivation" name="motivation" maxLength={1000} placeholder="介绍你希望参与的方向或可以贡献的能力" /><button disabled={pending}>{pending ? '提交中…' : '提交申请'}</button><button type="button" onClick={() => setOpen(false)}>取消</button><small role="status">{message}</small></form>;
}
