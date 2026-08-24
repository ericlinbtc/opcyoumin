import 'server-only';

import { cache } from 'react';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { getDatabase } from '@/db';
import { cities, policies } from '@/db/schema';
import { officialPolicies, type PublicPolicy } from '@/features/catalog/policies';
import { isLocalDemoMode } from '@/lib/env';

export const listPublicPolicies = cache(async (cityId?: string): Promise<PublicPolicy[]> => {
  if (isLocalDemoMode()) return officialPolicies.map((policy) => ({ ...policy, keyPoints: [...policy.keyPoints] }));
  const rows = await getDatabase().select({
    id: policies.id,
    city: cities.name,
    title: policies.title,
    category: policies.category,
    summary: policies.summary,
    interpretation: policies.interpretation,
    keyPoints: policies.keyPoints,
    issuingAuthority: policies.issuingAuthority,
    documentNumber: policies.documentNumber,
    sourceName: policies.sourceName,
    sourceUrl: policies.sourceUrl,
    publishedAt: policies.publishedAt,
    effectiveAt: policies.effectiveAt,
  }).from(policies).leftJoin(cities, eq(cities.id, policies.cityId))
    .where(and(eq(policies.status, 'published'), cityId ? or(eq(policies.cityId, cityId), isNull(policies.cityId)) : undefined))
    .orderBy(desc(policies.publishedAt));
  return rows.map(({ publishedAt, effectiveAt, ...policy }) => ({
    ...policy,
    publishedAt: publishedAt.toISOString(),
    effectiveAt: effectiveAt?.toISOString() ?? null,
  }));
});

export const getPublicPolicy = cache(async (id: string): Promise<PublicPolicy | null> => {
  if (isLocalDemoMode()) return officialPolicies.find((policy) => policy.id === id) ?? null;
  const rows = await getDatabase().select({
    id: policies.id,
    city: cities.name,
    title: policies.title,
    category: policies.category,
    summary: policies.summary,
    interpretation: policies.interpretation,
    keyPoints: policies.keyPoints,
    issuingAuthority: policies.issuingAuthority,
    documentNumber: policies.documentNumber,
    sourceName: policies.sourceName,
    sourceUrl: policies.sourceUrl,
    publishedAt: policies.publishedAt,
    effectiveAt: policies.effectiveAt,
  }).from(policies).leftJoin(cities, eq(cities.id, policies.cityId))
    .where(and(eq(policies.id, id), eq(policies.status, 'published'))).limit(1);
  const policy = rows[0];
  return policy ? { ...policy, publishedAt: policy.publishedAt.toISOString(), effectiveAt: policy.effectiveAt?.toISOString() ?? null } : null;
});
