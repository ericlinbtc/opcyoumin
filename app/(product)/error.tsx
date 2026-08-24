'use client';

import { useEffect } from 'react';

export default function ProductError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="system-state"><small>REQUEST FAILED</small><h1>页面暂时无法加载</h1><p>请稍后重试。如果问题持续存在，请向运营人员提供错误编号：{error.digest ?? '未知'}。</p><button onClick={reset}>重新加载</button></main>;
}
