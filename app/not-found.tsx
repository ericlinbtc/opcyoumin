import Link from 'next/link';

export default function NotFound() {
  return <main className="system-state"><small>404 NOT FOUND</small><h1>没有找到这个页面</h1><p>链接可能已失效，或内容已经不再公开。</p><Link href="/">返回首页</Link></main>;
}
