'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="zh-CN"><body><main className="system-state"><h1>服务暂时不可用</h1><p>我们已经记录问题，请稍后重试。</p><button onClick={reset}>重试</button></main></body></html>;
}
