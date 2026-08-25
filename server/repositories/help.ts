import 'server-only';

import { asc, eq } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { helpFaqs } from '@/db/schema';
import { defaultHelpFaqs, type HelpFaq } from '@/features/catalog/help';
import { isLocalDemoMode } from '@/lib/env';

export async function listPublishedHelpFaqs(): Promise<HelpFaq[]> {
  if (isLocalDemoMode()) return defaultHelpFaqs.map((item) => ({ ...item }));
  return getDatabase().select({
    id: helpFaqs.id,
    slug: helpFaqs.slug,
    category: helpFaqs.category,
    question: helpFaqs.question,
    answer: helpFaqs.answer,
  }).from(helpFaqs).where(eq(helpFaqs.status, 'published')).orderBy(asc(helpFaqs.sortOrder), asc(helpFaqs.createdAt));
}
