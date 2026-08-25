'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markActivityAttendance } from '@/features/activities/actions';

export function AttendanceControls({ activityId, userId, currentStatus }: { activityId: string; userId: string; currentStatus: string }) {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const mark = (status: 'attended' | 'no_show') => startTransition(async () => {
    const result = await markActivityAttendance({ activityId, userId, status });
    setMessage(result.ok ? '出席状态已更新' : result.message);
    if (result.ok) router.refresh();
  });
  return <span className="owner-controls"><button type="button" disabled={pending || currentStatus === 'attended'} onClick={() => mark('attended')}>确认签到</button><button type="button" disabled={pending || currentStatus === 'no_show'} onClick={() => mark('no_show')}>标记缺席</button><small role="status">{message}</small></span>;
}
