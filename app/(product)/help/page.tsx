import type { Metadata } from 'next';
import { PageHero } from '@/components/product-shell';
import { HelpCenter } from '@/features/help/help-center';

export const metadata: Metadata = { title: '帮助中心｜游民', description: '游民 OPC 社区使用指南、常见问题和网站信息。' };

export default function HelpPage() {
  return <main className="feature-page help-center"><PageHero eyebrow="SUPPORT & GUIDE" title="帮助" description="查找使用指南、常见问题与社区规则，或者直接告诉我们你遇到的问题。" count="24h" unit="社区响应" /><HelpCenter /></main>;
}
