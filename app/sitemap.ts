import type { MetadataRoute } from 'next';
import { getServerEnv } from '@/lib/env';
import { listInsights, listKnowledge, listPublicActivities, listPublicCities } from '@/server/repositories/public-content';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = new URL(getServerEnv().APP_URL).origin;
  const [cities, activities, knowledge, insights] = await Promise.all([listPublicCities(), listPublicActivities(), listKnowledge(), listInsights()]);
  const route = (path: string, changeFrequency: 'daily' | 'weekly' | 'monthly' = 'weekly', priority = 0.7) => ({ url: `${origin}${path}`, lastModified: new Date(), changeFrequency, priority });
  return [route('/', 'daily', 1), route('/cities', 'daily', .9), route('/activities', 'daily', .8), route('/knowledge'), route('/insights'), ...cities.map((item) => route(`/cities/${item.slug}`, 'daily', .8)), ...activities.map((item) => route(`/activities/${item.id}`, 'weekly', .7)), ...knowledge.map((item) => route(`/knowledge/${item.slug}`, 'monthly', .6)), ...insights.map((item) => route(`/insights/${item.slug}`, 'weekly', .6))];
}
