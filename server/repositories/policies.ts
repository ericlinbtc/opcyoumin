import 'server-only';

import { cache } from 'react';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
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
    sourceCheckedAt: policies.sourceCheckedAt,
    revisionNote: policies.revisionNote,
    supersededAt: policies.supersededAt,
    publishedAt: policies.publishedAt,
    effectiveAt: policies.effectiveAt,
  }).from(policies).leftJoin(cities, eq(cities.id, policies.cityId))
    .where(and(eq(policies.status, 'published'), cityId ? or(eq(policies.cityId, cityId), isNull(policies.cityId)) : undefined))
    .orderBy(desc(policies.publishedAt));
  return rows.map(({ publishedAt, effectiveAt, sourceCheckedAt, supersededAt, ...policy }) => ({
    ...policy,
    publishedAt: publishedAt.toISOString(),
    effectiveAt: effectiveAt?.toISOString() ?? null,
    sourceCheckedAt: sourceCheckedAt?.toISOString() ?? null,
    supersededAt: supersededAt?.toISOString() ?? null,
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
    sourceCheckedAt: policies.sourceCheckedAt,
    revisionNote: policies.revisionNote,
    supersededAt: policies.supersededAt,
    publishedAt: policies.publishedAt,
    effectiveAt: policies.effectiveAt,
  }).from(policies).leftJoin(cities, eq(cities.id, policies.cityId))
    .where(and(eq(policies.id, id), or(eq(policies.status, 'published'), sql`${policies.supersededAt} is not null`))).limit(1);
  const policy = rows[0];
  return policy ? { ...policy, publishedAt: policy.publishedAt.toISOString(), effectiveAt: policy.effectiveAt?.toISOString() ?? null, sourceCheckedAt: policy.sourceCheckedAt?.toISOString() ?? null, supersededAt: policy.supersededAt?.toISOString() ?? null } : null;
});
