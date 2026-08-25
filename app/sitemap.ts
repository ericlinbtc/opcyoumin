import type { MetadataRoute } from 'next';
import { getServerEnv } from '@/lib/env';
import { listInsights, listKnowledge, listPublicActivities, listPublicCities, listPublicMemberSitemapEntries, listPublicPostSitemapEntries } from '@/server/repositories/public-content';
import { listPublicPolicies } from '@/server/repositories/policies';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = new URL(getServerEnv().APP_URL).origin;
  const [cities, activities, knowledge, insights, policies, publicPosts, publicMembers] = await Promise.all([listPublicCities(), listPublicActivities(), listKnowledge(), listInsights(), listPublicPolicies(), listPublicPostSitemapEntries(), listPublicMemberSitemapEntries()]);
  const route = (path: string, changeFrequency: 'daily' | 'weekly' | 'monthly' = 'weekly', priority = 0.7, lastModified = new Date()) => ({ url: `${origin}${path}`, lastModified, changeFrequency, priority });
  return [route('/', 'daily', 1), route('/cities', 'daily', .9), route('/activities', 'daily', .8), route('/organizations'), route('/policies'), route('/knowledge'), route('/insights'), ...cities.map((item) => route(`/cities/${item.slug}`, 'daily', .8)), ...activities.map((item) => route(`/activities/${item.id}`, 'weekly', .7, new Date(item.startsAt))), ...knowledge.map((item) => route(`/knowledge/${item.slug}`, 'monthly', .6, item.updatedAt)), ...insights.map((item) => route(`/insights/${item.slug}`, 'weekly', .6, item.updatedAt)), ...policies.map((item) => route(`/policies/${item.id}`, 'monthly', .7, new Date(item.sourceCheckedAt ?? item.publishedAt))), ...publicPosts.map((item) => route(`/posts/${item.id}`, 'weekly', .5, item.updatedAt)), ...publicMembers.map((item) => route(`/members/${item.id}`, 'weekly', .4, item.updatedAt))];
}
