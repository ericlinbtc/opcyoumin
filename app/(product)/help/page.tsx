import type { Metadata } from 'next';
import { PageHero } from '@/components/product-shell';
import { HelpCenter } from '@/features/help/help-center';
import { createPageMetadata } from '@/lib/seo';
import { listPublishedHelpFaqs } from '@/server/repositories/help';

export const metadata: Metadata = createPageMetadata({ title: '帮助中心｜游民', description: '游民 OPC 社区使用指南、常见问题和网站信息。', canonical: '/help' });

export default async function HelpPage() {
  const questions = await listPublishedHelpFaqs();
  return <main className="feature-page help-center"><PageHero eyebrow="SUPPORT & GUIDE" title="帮助" description="查找使用指南、常见问题与社区规则，或者直接告诉我们你遇到的问题。" count={String(questions.length)} unit="条常见问题" /><HelpCenter questions={questions} /></main>;
}
